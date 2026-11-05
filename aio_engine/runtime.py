"""Staged web orchestration. The notebook's audit and scoring functions are replayed unchanged."""
import base64
import io
import json
import re
import time
import types
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote
import numpy as np
import pandas as pd
import requests
from google import genai
from .security import public_get
from . import evidence, embeddings, review

_SOURCE = compile(Path(__file__).with_name('notebook.py').read_text(), 'aio_notebook', 'exec')
DEFAULTS = {'n_queries': 15, 'top_competitors': 10, 'threshold': .85, 'provider': 'serper',
            'llm_model': 'gemini-3.8-flash', 'embed_model': 'gemini-embedding-001',
            'country': 'vn', 'language': 'vi', 'location': 'Vietnam', 'generation_language': 'Vietnamese', 'manual_aio': ''}


class StepDeadline(Exception):
    pass


class RequestBudget:
    """Leave time to save a checkpoint before the serverless request expires."""
    def __init__(self):
        self.deadline = time.monotonic() + 240
        self.exhausted = False

    def check(self, reserve=0):
        if self.deadline - time.monotonic() <= reserve:
            self.exhausted = True
            raise StepDeadline('Đã lưu bước đang dở do giới hạn thời gian. Chọn Tiếp tục audit để chạy phần còn lại.')

    def sleep(self, seconds):
        if seconds > 300:
            raise RuntimeError(f'Gemini đã hết quota, cần chờ khoảng {seconds / 3600:.1f} giờ. Tiến độ đã lưu; hãy tiếp tục khi quota được cấp lại hoặc dùng API key còn quota.')
        self.check(seconds + 65)
        time.sleep(seconds)

    def call(self, fn, reserve=65):
        def guarded(*args, **kwargs):
            self.check(reserve)
            return fn(*args, **kwargs)
        return guarded


def validate_config(value):
    if not isinstance(value, dict):
        raise ValueError('Cấu hình audit không hợp lệ.')
    config = {**DEFAULTS, **{k: v for k, v in value.items() if k in DEFAULTS},
              'keyword': str(value.get('keyword', '')).strip().strip('"\'').strip(),
              'my_url': str(value.get('my_url', '')).strip().strip('"\'').strip()}
    if not config['keyword'] or len(config['keyword']) > 500:
        raise ValueError('Nhập từ khóa mục tiêu, tối đa 500 ký tự.')
    from urllib.parse import urlsplit
    url = urlsplit(config['my_url'])
    if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password:
        raise ValueError('Nhập URL đầy đủ bắt đầu bằng http:// hoặc https://.')
    for field, lo, hi in [('n_queries', 5, 30), ('top_competitors', 3, 20)]:
        number = config[field]
        if isinstance(number, bool) or not isinstance(number, (int, float)) or not lo <= number <= hi or int(number) != number:
            raise ValueError(f'{field} phải là số nguyên từ {lo} đến {hi}.')
        config[field] = int(number)
    if not isinstance(config['threshold'], (int, float)) or not .50 <= config['threshold'] <= .99:
        raise ValueError('Ngưỡng gom door phải từ 0,50 đến 0,99.')
    if config['provider'] not in ('serper', 'serpapi', 'dataforseo', 'none'):
        raise ValueError('Nhà cung cấp SERP không hợp lệ.')
    for field in ('llm_model', 'embed_model'):
        if not isinstance(config[field], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/\-]{0,120}', config[field]):
            raise ValueError('Tên model không hợp lệ.')
    for field in ('country', 'language', 'location', 'generation_language', 'manual_aio'):
        if not isinstance(config[field], str) or len(config[field]) > (20000 if field == 'manual_aio' else 150):
            raise ValueError('Cấu hình thị trường hoặc danh sách citation không hợp lệ.')
    return config


def engine(config, credentials=None):
    ns = {'__name__': 'aio_request'}
    exec(_SOURCE, ns)
    credentials = credentials or {}
    ns.update(_extract=evidence.article_text, chunk_text=evidence.passages, COUNTRY=config['country'], LANGUAGE=config['language'], LOCATION=config['location'], GEN_LANG=config['generation_language'],
              LLM_MODEL=config['llm_model'], EMBED_MODEL=config['embed_model'], N_QUERIES=config['n_queries'],
              TOP_N_COMPETITORS=config['top_competitors'], DOOR_THRESHOLD=config['threshold'], SERP_PROVIDER=config['provider'],
              SERP_API_KEY=credentials.get('serp', ''),
              MANUAL_AIO_CITATIONS=[ns['clean'](x) for x in re.split(r'[\n,]+', config['manual_aio']) if ns['clean'](x)])
    ns['FANOUT_PROMPT'] += "\nEvery query must stay on the user's specific subject. Cover only facets that genuinely apply; do not invent product facts, prices, or named alternatives."
    ns['FANOUT_PROMPT'] += "\nMake every query self-contained with the specific subject/model. Preserve different intents (price, warranty, duration, risks, compatibility); do not replace them with generic topic questions."
    ns['cluster_doors'] = lambda queries, vectors, threshold: evidence.cluster_doors(queries, vectors, threshold, ns['cosine'])
    if credentials.get('gemini'):
        actual = genai.Client(api_key=credentials['gemini'], http_options={'timeout': 60000})
        budget = RequestBudget()
        ns['_budget'] = budget
        ns['client'] = types.SimpleNamespace(close=actual.close, models=types.SimpleNamespace(
            generate_content=budget.call(actual.models.generate_content), embed_content=budget.call(actual.models.embed_content)))
        ns['time'] = types.SimpleNamespace(time=time.time, sleep=budget.sleep)
        ns['requests'] = types.SimpleNamespace(get=budget.call(public_get), post=budget.call(requests.post))
    else:
        ns['requests'] = types.SimpleNamespace(get=public_get, post=requests.post)
    ns['embed_batch'] = lambda texts, **kwargs: embeddings.embed(texts, ns['client'], ns['EMBED_MODEL'], ns['time'].sleep, ns.get('print', print), **kwargs)
    def retry_unavailable(fn, delay=2):
        for attempt in range(3):
            try:
                return fn()
            except Exception as exc:
                if not ns['_is_503'](exc) or attempt == 2:
                    raise
                ns['time'].sleep(delay * (attempt + 1))
    ns['_retry_503'] = retry_unavailable
    return ns


def close_engine(ns):
    if ns.get('client'):
        ns['client'].close()


def json_rows(frame):
    return json.loads(frame.to_json(orient='records', force_ascii=False))


def redact(message, credentials):
    for secret in credentials.values():
        if isinstance(secret, str) and secret:
            for value in (secret, quote(secret, safe=''), base64.b64encode(secret.encode()).decode()):
                message = message.replace(value, '[ẩn]')
    return message


def explain_error(message):
    if 'free tier is not available for this project' in message.lower():
        return ('Google từ chối Gemini API key vì project chưa được dùng gói miễn phí. '
                'Hãy bật thanh toán cho project tại https://aistudio.google.com/billing '
                'hoặc dùng API key của project khác có quyền truy cập Gemini. Sau đó chạy lại audit.')
    return message


def require_keys(config, credentials):
    if not credentials.get('gemini'):
        raise ValueError('Nhập Gemini API key trước khi chạy audit.')
    if config['provider'] != 'none' and not credentials.get('serp'):
        raise ValueError('Nhập API key cho nhà cung cấp SERP đã chọn.')


def distinct_queries(queries):
    """Discard repeated or malformed LLM output before paying to embed it."""
    seen, result = set(), []
    for value in queries:
        if not isinstance(value, str):
            continue
        query = ' '.join(value.strip().strip('"\'').split())
        key = re.sub(r'[^\w]+', '', evidence.normalized(query))
        if 5 <= len(query) <= 250 and key not in seen:
            seen.add(key)
            result.append(query)
    if not result:
        raise RuntimeError('Gemini chưa tạo được query hợp lệ. Hãy thử lại audit.')
    return result


def start(store, config, credentials):
    config = validate_config(config)
    require_keys(config, credentials)
    job = uuid.uuid4().hex
    state = {'id': job, 'stage': 'fanout', 'config': config, 'page_index': 0, 'logs': [], 'error': '', 'progress': 0}
    store.create(job, state)
    return state


def replay(ns, state, seed, pages):
    config = state['config']
    own = config['my_url']
    queries = [(q, np.asarray(v, dtype='float32')) for q, v in zip(seed['queries'], seed['vectors'], strict=True) if len(v)]
    doors = ns['cluster_doors']([q for q, _ in queries], [v for _, v in queries], config['threshold'])
    door_vecs = [queries[d['member_indices'][0]][1] for d in doors]
    # Drop the text AND vector together: an empty embedding must never shift later quotations.
    sources = {}
    for url, page in pages.items():
        pairs = [(t, np.asarray(v, dtype='float32')) for t, v in zip(page['chunks'], page['vectors'], strict=True) if t and len(v)]
        if pairs:
            sources[url] = list(zip(*pairs))
    if own not in sources:
        if pages.get(own, {}).get('readable'):
            sources[own] = ([], [])
        else:
            raise RuntimeError('Trang mục tiêu chưa có đoạn nội dung chấm được. Hãy thử audit lại.')
    mean = np.mean(np.stack(door_vecs + [v for _, vs in sources.values() for v in vs]), axis=0)
    index = {url: evidence.passage_index(texts) for url, (texts, _) in sources.items()}
    centered = {url: [v - mean for v in vs] for url, (_, vs) in sources.items()}
    rows, passages = [], {}
    for door, vec in zip(doors, door_vecs):
        q, vector = door['representative'], vec - mean
        hits = {}
        for url, (texts, _) in sources.items():
            hit = evidence.match(q, texts, vector, centered[url], ns['cosine'], *index[url], keyword=config['keyword'])
            if hit is not None:
                hits[url] = hit
        mine = hits.pop(own, None)
        rivals = sorted(hits, key=lambda url: -hits[url][0])
        score = mine[0] if mine else None
        excerpt = sources[own][0][mine[1]] if mine else ''
        leader = rivals[0] if rivals else None
        best = hits[leader][0] if leader else None
        measured = mine is not None and leader is not None
        if measured:
            scores = ns['score_door'](vector, [centered[own][mine[1]]],
                {url: [centered[url][hits[url][1]]] for url in rivals})
        rows.append(dict(door=q, merged_variants=len(door['members']), your_score=round(score, 4) if mine else None,
            best_rival_score=round(best, 4) if leader else None, gap=scores['gap'] if measured else None,
            your_rank=f"{scores['my_rank']}/{scores['field_size']}" if measured else '—',
            spread=scores['spread'] if measured else None,
            verdict=ns['verdict'](scores) if measured else 'INSUFFICIENT - no comparable passage',
            best_rival=leader or '', your_best_passage=excerpt[:180] + ('…' if excerpt else '')))
        comparison = (dict(url=leader, score=best, gap=best-score if mine else None,
            passage=sources[leader][0][hits[leader][1]]) if leader else None)
        passages[q] = dict(score=score, passage=excerpt, comparison=comparison, rivals=[
            dict(url=url, score=hits[url][0], gap=hits[url][0]-score if mine else None, passage=sources[url][0][hits[url][1]])
            for url in rivals if not mine or hits[url][0] > score][:3])
    rows.sort(key=lambda row: row['gap'] if row['gap'] is not None else -float('inf'), reverse=True)
    return {'id': state['id'], 'config': config, 'rows': rows, 'doors': doors,
            'competitors': list(dict.fromkeys(seed['serp']['aio_citations'] + seed['serp']['organic']))[:config['top_competitors']],
            'passages': passages, 'query_count': len(seed['queries']),
            'read_competitors': sum(bool(page.get('readable') or page['chunks']) for url, page in pages.items() if url != own)}


def page_chunks(ns, store, state):
    """Prefetch pages concurrently; keep embedding calls serial to preserve the quota."""
    job, index = state['id'], state['page_index']
    content, missing = {}, []
    for i in range(index, len(state['urls'])):
        try:
            content[i] = store.artifact(job, f'content-{i}')
        except FileNotFoundError:
            missing.append(i)

    def fetch(i):
        try:
            chunks = ns['chunk_text'](ns['fetch_page_text'](state['urls'][i]), ns['MAX_CHARS'], ns['OVERLAP_CHARS'])
            if not chunks:
                raise RuntimeError('no usable chunks')
            return {'chunks': chunks}
        except Exception as exc:
            return {'error': str(exc)}

    with ThreadPoolExecutor(max_workers=5) as pool:
        for i, item in zip(missing, pool.map(fetch, missing)):
            content[i] = item
            # Failed downloads remain retryable; successful pages survive a quota pause.
            if 'chunks' in item:
                store.artifact(job, f'content-{i}', item)
    item = content[index]
    if ns.get('_budget') and ns['_budget'].exhausted:
        raise StepDeadline('Đã lưu nội dung tải xong. Chọn Tiếp tục audit để chạy tiếp.')
    if 'error' in item:
        if index == 0:
            raise RuntimeError('Không đọc được trang mục tiêu. Dừng audit để tránh điểm giả.')
        ns['print'](f"Bỏ qua {state['urls'][index]}: {item['error']}")
    return item.get('chunks', [])


def step(store, job, credentials):
    state = store.claim(job)
    state.pop('retry_after', None)
    log = io.StringIO()
    ns = None
    try:
        if state['stage'] == 'done':
            return state
        config = state['config']
        require_keys(config, credentials)
        ns = engine(config, credentials)
        # A per-request print binding avoids redirecting other concurrent users' stdout.
        ns['print'] = lambda *args, **kwargs: print(*args, **{**kwargs, 'file': log})
        if state['stage'] == 'fanout':
            ns['print'](f"Model sinh query: {config['llm_model']} · Model embedding: {config['embed_model']}")
            try:
                fanout = store.artifact(job, 'fanout')
                queries = fanout['queries']
            except FileNotFoundError:
                queries = distinct_queries(ns['generate_fanout'](config['keyword'], config['n_queries']))
                fanout = {'queries': queries}
                store.artifact(job, 'fanout', fanout)
            def save_queries(batch):
                fanout.setdefault('vectors', {}).update({text: vector.tolist() for text, vector in batch.items()})
                store.artifact(job, 'fanout', fanout)
            vectors = ns['embed_batch'](queries, known=fanout.get('vectors'), on_batch=save_queries)
            valid = [(q, v) for q, v in zip(queries, vectors) if v.size]
            if not valid:
                raise RuntimeError('Không có query embedding hợp lệ để gom door.')
            doors = ns['cluster_doors']([q for q, _ in valid], [v for _, v in valid], config['threshold'])
            serp = ns['fetch_serp'](config['keyword'])
            rivals = list(dict.fromkeys(serp['aio_citations'] + serp['organic']))[:config['top_competitors']]
            store.artifact(job, 'seed', {'queries': queries, 'vectors': [v.tolist() for v in vectors], 'serp': serp})
            state.update(stage='pages', urls=[config['my_url']] + [u for u in rivals if u.rstrip('/') != config['my_url'].rstrip('/')], door_count=len(doors), progress=15)
        elif state['stage'] == 'pages':
            index = state['page_index']
            chunks = page_chunks(ns, store, state)
            readable = bool(chunks)
            if chunks:
                seed = store.artifact(job, 'seed')
                query_vectors = [np.asarray(v, dtype='float32') for v in seed['vectors']]
                valid = [(q, v) for q, v in zip(seed['queries'], query_vectors, strict=True) if v.size]
                queries = [door['representative'] for door in ns['cluster_doors'](
                    [q for q, _ in valid], [v for _, v in valid], state['config']['threshold'])]
                chosen = evidence.select_passages(chunks, queries, keyword=config['keyword'])
                ns['print'](f'Đoạn liên quan query: {len(chosen)}/{len(chunks)}')
                chunks = chosen
            known = {}
            if chunks:
                for text, vector in zip(seed['queries'], seed['vectors'], strict=True):
                    if text in chunks and vector:
                        known[text] = vector
                for previous in range(index + 1):
                    try:
                        saved = store.artifact(job, f'page-{previous}')
                    except FileNotFoundError:
                        continue
                    if previous == index and saved['chunks'] != chunks:
                        raise RuntimeError('Nội dung trang đã đổi trong lúc tiếp tục audit; dừng để tránh chấm sai.')
                    for text, vector in zip(saved['chunks'], saved['vectors'], strict=True):
                        if text in chunks and vector:
                            known[text] = vector
            def save_page_batch(batch):
                known.update({text: vector.tolist() for text, vector in batch.items()})
                store.artifact(job, f'page-{index}', {'chunks': chunks,
                    'vectors': [known.get(text, []) for text in chunks], 'readable': readable})
            vectors = ns['embed_batch'](chunks, known=known, on_batch=save_page_batch) if chunks else []
            store.artifact(job, f'page-{index}', {'chunks': chunks, 'vectors': [v.tolist() for v in vectors], 'readable': readable})
            state.update(page_index=index+1, progress=15+int(70*(index+1)/len(state['urls'])))
            if state['page_index'] == len(state['urls']):
                state['stage'] = 'score'
        elif state['stage'] == 'score':
            try:
                store.artifact(job, 'result')
            except FileNotFoundError:
                seed = store.artifact(job, 'seed')
                pages = {url: store.artifact(job, f'page-{i}') for i, url in enumerate(state['urls'])}
                result = review.apply(ns, replay(ns, state, seed, pages))
                if ns.get('_budget') and ns['_budget'].exhausted:
                    raise StepDeadline('Đã lưu bước đối chiếu; audit sẽ tiếp tục trong lượt xử lý sau.')
                store.artifact(job, 'result', result)
            state.update(stage='done', progress=100)
        else:
            raise ValueError('Bước audit không hợp lệ.')
        state['error'] = ''
    except StepDeadline:
        state.update(error='', retry_after=1)
    except Exception as exc:
        state['error'] = str(exc)
        raise
    finally:
        if ns:
            close_engine(ns)
        state['logs'] = (state.get('logs', []) + log.getvalue().splitlines())[-120:]
        # Provider messages can echo credentials; scrub before any checkpoint write.
        state['error'] = explain_error(redact(state.get('error', ''), credentials))
        state['logs'] = [redact(line, credentials) for line in state['logs']]
        store.save(job, state)
    return state


def restore_result(result):
    ns = engine(result['config'])
    ns.update(df=pd.DataFrame(result['rows']), LAST_TARGET_URL=result['config']['my_url'],
              LAST_KEYWORD=result['config']['keyword'], LAST_AUDIT_ID=result['id'], LAST_DOORS=result['doors'])
    return ns, ns['_rank_context']()


def rank_analysis(result, rows):
    ns, context = restore_result(result)
    summary, frame, debug = ns['run_rank_analysis_ui'](rows, context)
    if debug != 'No error.':
        raise ValueError(summary)
    uncertain = frame['verdict'].str.startswith('INSUFFICIENT')
    if uncertain.any():
        frame.loc[uncertain, 'action'] = '7 · Kiểm tra nội dung cho query'
        frame = frame.sort_values(['action', 'gap'], ascending=[True, False], na_position='last')
        summary = summary.partition('### Counts')[0] + '### Counts\n' + '\n'.join(
            f'- {label}: {count}' for label, count in frame['action'].value_counts().items())
    return {'input': json_rows(ns['LAST_RANK_INPUT']), 'rows': json_rows(frame), 'summary': summary,
            'k': ns['k'], 'total': ns['total'], 'probability': 1-.91**(ns['k']+1),
            'increment': ((1-.91**(ns['k']+2))-(1-.91**(ns['k']+1)))*100}


def rank_file(result, rows=None):
    ns, context = restore_result(result)
    table = ns['make_rank_template'](context) if rows is None else ns['_normalise_rank_input'](rows, context)
    path = Path(ns['_write_rank_xlsx'](table, context))
    try:
        return path.read_bytes()
    finally:
        path.unlink(missing_ok=True)
        path.parent.rmdir()


def import_ranks(result, content):
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        if len(archive.infolist()) > 128 or sum(item.file_size for item in archive.infolist()) > 32 * 1024 * 1024:
            raise ValueError('File XLSX sau giải nén quá lớn.')
    with pd.ExcelFile(io.BytesIO(content), engine='openpyxl') as book:
        name = 'Ranks' if 'Ranks' in book.sheet_names else book.sheet_names[0]
        table = pd.read_excel(book, sheet_name=name, dtype=object, keep_default_na=False)
    return rank_analysis(result, table)
