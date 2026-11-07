"""Offline parity and trust-boundary checks; no production DB or paid API calls."""
import ast
import copy
import gzip
import io
import json
import os
import socket
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from email.message import Message
import numpy as np
import pandas as pd
from aio_engine import runtime, security, evidence, embeddings, review
from types import SimpleNamespace
from unittest.mock import Mock
from aio_engine.storage import Store
from api.aio import handler, dispatch

CONFIG = runtime.validate_config({'keyword': 'thay pin iPhone', 'my_url': 'https://example.com/target'})
QUERIES = ['Chi phí thay pin?', 'Giá thay pin?', 'Khi nào cần thay?', 'Pin nào phù hợp?', 'Thay ở đâu?']
VECTORS = [[1, .2, .1], [.99, .21, .11], [.1, 1, .2], [.2, .1, 1], [.6, .5, .7]]
SERP = {'organic': ['https://one.example/a', 'https://two.example/b', 'https://blocked.example/c'], 'aio_citations': []}
PAGES = {
    CONFIG['my_url']: {'chunks': ['Chi phí, khi nào cần thay pin, loại pin phù hợp và thay ở đâu. ' * 12, 'Chi phí, khi nào cần thay pin, loại pin phù hợp và thay ở đâu? ' * 12], 'vectors': [[.5, .2, .4], [.2, .9, .1]]},
    SERP['organic'][0]: {'chunks': ['Chi phí, khi nào cần thay pin, loại pin phù hợp và thay ở đâu! ' * 12], 'vectors': [[1, .1, .1]]},
    SERP['organic'][1]: {'chunks': ['Chi phí, khi nào cần thay pin, loại pin phù hợp và thay ở đâu… ' * 12], 'vectors': [[.15, .2, .95]]},
    SERP['organic'][2]: {'chunks': [], 'vectors': []},
}
for page in PAGES.values():
    page['chunks'] = [text + ' Giá thay pin iPhone là 800.000 đồng, thời gian 30 phút.' for text in page['chunks']]
SEED = {'queries': QUERIES, 'vectors': VECTORS, 'serp': SERP}


class MemoryStore:
    def __init__(self):
        self.states, self.artifacts, self.cached = {}, {}, {}
        self.leased = set()
    def create(self, job, state): self.states[job] = copy.deepcopy(state)
    def read(self, job): return copy.deepcopy(self.states[job])
    def claim(self, job):
        if job in self.leased: raise BlockingIOError('busy')
        self.leased.add(job)
        return self.read(job)
    def save(self, job, state):
        self.states[job] = copy.deepcopy(state)
        self.leased.discard(job)
    def artifact(self, job, name, value=None):
        if value is None:
            if (job, name) not in self.artifacts: raise FileNotFoundError()
            return copy.deepcopy(self.artifacts[(job, name)])
        self.artifacts[(job, name)] = copy.deepcopy(value)
    def cache(self, key, value=None):
        if value is None:
            if key not in self.cached: raise FileNotFoundError()
            return copy.deepcopy(self.cached[key])
        self.cached[key] = copy.deepcopy(value)


def fixture_result():
    return runtime.replay(runtime.engine(CONFIG), {'id': 'a' * 32, 'config': CONFIG}, copy.deepcopy(SEED), copy.deepcopy(PAGES))


class NotebookParity(unittest.TestCase):
    def test_selected_generation_model_reaches_gemini(self):
        ns = runtime.engine({**CONFIG, 'llm_model': 'gemini-3.5-flash-lite'})
        generate = Mock(return_value=SimpleNamespace(text='["Giá thay pin iPhone?"]'))
        ns['client'] = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        ns['generate_fanout']('thay pin iPhone', 5)
        self.assertEqual(generate.call_args.kwargs['model'], 'gemini-3.5-flash-lite')

    def test_embedding_2_sends_separate_content_for_each_text(self):
        call = Mock(return_value=SimpleNamespace(embeddings=[SimpleNamespace(values=[1., 2.]), SimpleNamespace(values=[2., 1.])]))
        client = SimpleNamespace(models=SimpleNamespace(embed_content=call))
        embeddings.embed(['query', 'passage'], client, 'gemini-embedding-2', Mock(), Mock())
        contents = call.call_args.kwargs['contents']
        self.assertEqual([item.parts[0].text for item in contents], ['query', 'passage'])
    def test_calculation_matches_original_functions(self):
        # The exact audit() executes once with mocked I/O, once with staged replay.
        ns = runtime.engine(CONFIG)
        ns['generate_fanout'] = lambda *_: QUERIES
        ns['fetch_serp'] = lambda *_: SERP
        ns['fetch_page_text'] = lambda url: url
        ns['chunk_text'] = lambda url, *_: PAGES[url]['chunks']
        def embed(texts):
            values = VECTORS if texts is QUERIES else next(p['vectors'] for p in PAGES.values() if texts is p['chunks'])
            return [np.array(v, dtype='float32') for v in values]
        ns['embed_batch'] = embed
        with patch('sys.stdout', new=io.StringIO()):
            original, doors, competitors = ns['audit'](CONFIG['keyword'], CONFIG['my_url'], 15, False)
            replayed = fixture_result()
        self.assertEqual(runtime.json_rows(original), [{k: v for k, v in row.items() if k != 'reason'} for row in replayed['rows']])
        self.assertEqual(doors, replayed['doors'])
        self.assertEqual(competitors, replayed['competitors'])
        self.assertEqual(replayed['read_competitors'], 2)
        self.assertEqual(replayed['query_count'], 5)
        for row in replayed['rows']:
            self.assertIn(row['door'], replayed['passages'])
            for rival in replayed['passages'][row['door']]['rivals']:
                self.assertGreater(rival['score'], replayed['passages'][row['door']]['score'])

    def test_price_evidence_excludes_off_topic_and_handles_missing_vector(self):
        q = 'Chi phí thay pin iPhone là bao nhiêu?'
        seed = {'queries': [q], 'vectors': [[1., 0.]], 'serp': SERP}
        pages = {
            CONFIG['my_url']: {'chunks': ['Chi phí thay kính lưng.', 'Giá thay pin iPhone là 800.000 đồng.'], 'vectors': [[], [.8, .2]]},
            SERP['organic'][0]: {'chunks': ['Ceramic Shield bảo vệ mặt kính của iPhone.', 'Thay pin iPhone có chi phí 900.000 đồng.'], 'vectors': [[1., 0.], [.99, .01]]},
        }
        def run():
            return runtime.replay(runtime.engine(CONFIG), {'id': 'a'*32, 'config': CONFIG}, seed, pages)
        output = run()
        self.assertEqual(output['passages'][q]['passage'], pages[CONFIG['my_url']]['chunks'][1])
        rival = output['passages'][q]['rivals'][0]
        self.assertIn('900.000', rival['passage'])
        self.assertAlmostEqual(output['rows'][0]['gap'], rival['gap'], places=4)
        pages[SERP['organic'][0]]['chunks'][1] = 'Điều khoản sử dụng Ceramic Shield.'
        output = run()
        self.assertIsNone(output['rows'][0]['gap'])
        self.assertTrue(output['rows'][0]['verdict'].startswith('INSUFFICIENT'))

    def test_long_page_keeps_query_passages_and_reduces_embeddings(self):
        chunks = [f'Thông tin chung về điện thoại mục {i}.' for i in range(246)]
        chunks[91] = 'Giá thay pin iPhone là 800.000 đồng.'
        chunks[203] = 'Bảo hành pin iPhone trong 12 tháng.'
        chosen = evidence.select_passages(chunks, ['Giá thay pin iPhone?', 'Bảo hành pin iPhone bao lâu?'])
        self.assertIn(chunks[91], chosen)
        self.assertIn(chunks[203], chosen)
        self.assertLessEqual(len(chosen), 24)

    def test_semantically_close_but_different_intents_stay_separate(self):
        ns = runtime.engine(CONFIG)
        qs = ['Giá thay pin iPhone?', 'Bảo hành pin iPhone?', 'Chi phí thay pin iPhone?']
        groups = ns['cluster_doors'](qs, [np.array([1., 0.])]*3, .85)
        self.assertEqual([g['members'] for g in groups], [[qs[0], qs[2]], [qs[1]]])

    def test_hybrid_candidates_reject_wrong_device_and_unanswered_price(self):
        texts = ['Giá thay pin iPhone 16 là 900.000 đồng.',
                 'Giá thay pin iPhone 15 là bao nhiêu? Liên hệ để biết thêm.',
                 'Giá thay pin iPhone 15 là 800.000 đồng, bảo hành 12 tháng.']
        chosen = evidence.select_passages(texts, ['Chi phí thay pin iPhone 15?'])
        self.assertEqual(chosen, [texts[2]])

    def test_hybrid_scans_whole_page_and_accepts_accent_and_alias_variants(self):
        texts = ['Danh mục điện thoại và phụ kiện.' for _ in range(300)]
        texts.append('Cost thay battery iPhone 15 la 800.000 dong, bao hanh 12 thang.')
        self.assertEqual(evidence.select_passages(texts, ['Chi phí thay pin iPhone 15?']), [texts[-1]])

    def test_clear_local_passage_does_not_embed_a_weak_second_choice(self):
        query = 'Thay pin iPhone mất bao lâu?'
        direct = 'Thay pin iPhone tại cửa hàng mất 30 phút và khách lấy máy ngay.'
        weak = 'Pin iPhone được bảo hành trong 12 tháng, thời gian xử lý 60 phút.'
        self.assertEqual(evidence.select_passages([direct, weak], [query]), [direct])

    def test_review_keeps_notebook_score_and_requires_literal_evidence(self):
        query = 'Thay pin iPhone từng dòng máy mất bao lâu?'
        own = 'Thay pin iPhone thông thường mất khoảng 30-60 phút.'
        rival = 'iPhone 15 mất 30 phút; iPhone 16 mất 60 phút để thay pin.'
        def result():
            return {'rows': [{'door': query, 'verdict': 'BEHIND - close', 'gap': .0833}],
                    'doors': [{'representative': query, 'members': [query]}],
                    'passages': {query: {'passage': own, 'comparison': {'passage': rival}}}}
        ns = runtime.engine(CONFIG)
        ns['print'] = Mock()
        response = Mock(return_value=SimpleNamespace(text=json.dumps([{'id': 0, 'label': 'rival_better',
            'own_quote': 'thông thường mất khoảng 30-60 phút',
            'rival_quote': 'iPhone 15 mất 30 phút; iPhone 16 mất 60 phút',
            'aspect': 'từng dòng máy'}])))
        ns['client'] = SimpleNamespace(models=SimpleNamespace(generate_content=response))
        verified = review.apply(ns, result())['rows'][0]
        self.assertEqual((verified['verdict'], verified['gap']), ('BEHIND - close', .0833))
        self.assertEqual(verified['evidence_label'], 'Đối thủ trả lời rõ hơn')
        self.assertIn('từng dòng máy', verified['reason'])
        response.return_value.text = json.dumps([{'id': 0, 'label': 'rival_better',
            'own_quote': 'không có trong trang', 'rival_quote': 'iPhone 15 mất 30 phút; iPhone 16 mất 60 phút',
            'aspect': 'từng dòng máy'}])
        rejected = review.apply(ns, result())['rows'][0]
        self.assertEqual((rejected['verdict'], rejected['gap']), ('BEHIND - close', .0833))
        self.assertEqual(rejected['evidence_label'], 'Chưa đối chiếu nội dung')
        response.side_effect = RuntimeError('quota')
        limited = review.apply(ns, result())['rows'][0]
        self.assertEqual((limited['verdict'], limited['gap']), ('BEHIND - close', .0833))
        self.assertEqual(limited['evidence_label'], 'Chưa đối chiếu nội dung')

    def test_equal_quantitative_evidence_skips_extra_gemini_call(self):
        query = 'Thay pin iPhone mất bao lâu?'
        result = {'rows': [{'door': query, 'verdict': 'BEHIND - close', 'gap': .08}],
                  'passages': {query: {'passage': 'Thay pin iPhone mất 30 phút tại cửa hàng.',
                                      'comparison': {'passage': 'Thời gian thay pin iPhone là 30 phút.'}}}}
        ns = runtime.engine(CONFIG)
        generate = Mock()
        ns['client'] = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        reviewed = review.apply(ns, result)['rows'][0]
        self.assertEqual(reviewed['evidence_label'], 'Cùng dữ kiện định lượng')
        self.assertEqual((reviewed['verdict'], reviewed['gap']), ('BEHIND - close', .08))
        generate.assert_not_called()
        # A warranty number is not an answer to a service-time question.
        self.assertEqual(review._answer_facts(query, 'Bảo hành pin 12 tháng.'), set())

    def test_review_caps_one_request_and_never_overwrites_numeric_verdicts(self):
        rows = [{'door': f'Cách thay pin iPhone mẫu {i}?', 'verdict': 'BEHIND - clear', 'gap': .2}
                for i in range(12)]
        passages = {row['door']: {'passage': f'Trang bạn nói về pin iPhone mẫu {i}.',
                                  'comparison': {'passage': f'Đối thủ giải thích thay pin iPhone mẫu {i}.'}}
                    for i, row in enumerate(rows)}
        ns = runtime.engine(CONFIG)
        ns['print'] = Mock()
        generate = Mock(return_value=SimpleNamespace(text='[]'))
        ns['client'] = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        result = review.apply(ns, {'rows': rows, 'passages': passages})
        generate.assert_called_once()
        sent = json.loads(generate.call_args.kwargs['contents'][0].rsplit('\n', 1)[1])
        self.assertEqual(len(sent), review.MAX_AI_DOORS)
        self.assertTrue(all(row['verdict'] == 'BEHIND - clear' and row['gap'] == .2 for row in result['rows']))
        self.assertTrue(all(row['evidence_label'] == 'Chưa đối chiếu nội dung' for row in result['rows']))

    def test_different_prices_cannot_be_called_a_verified_content_gap(self):
        query = 'Giá thay pin iPhone là bao nhiêu?'
        own = 'Giá thay pin iPhone là 800.000 đồng.'
        rival = 'Giá thay pin iPhone là 900.000 đồng.'
        ns = runtime.engine(CONFIG)
        ns['print'] = Mock()
        response = [{'id': 0, 'label': 'rival_better', 'own_quote': own, 'rival_quote': rival,
                     'aspect': 'Giá thay pin iPhone'}]
        ns['client'] = SimpleNamespace(models=SimpleNamespace(
            generate_content=Mock(return_value=SimpleNamespace(text=json.dumps(response)))))
        result = {'rows': [{'door': query, 'verdict': 'BEHIND - clear', 'gap': .2}],
                  'passages': {query: {'passage': own, 'comparison': {'passage': rival}}}}
        row = review.apply(ns, result)['rows'][0]
        self.assertEqual(row['evidence_label'], 'Dữ kiện hoặc điều kiện khác nhau')
        self.assertEqual((row['verdict'], row['gap']), ('BEHIND - clear', .2))

    def test_readable_target_with_no_answer_does_not_invent_a_score(self):
        seed = {'queries': ['Giá thay pin iPhone?'], 'vectors': [[1., 0.]], 'serp': SERP}
        pages = {CONFIG['my_url']: {'chunks': [], 'vectors': [], 'readable': True},
                 SERP['organic'][0]: {'chunks': ['Giá thay pin iPhone là 800.000 đồng.'], 'vectors': [[.8, .2]]}}
        result = runtime.replay(runtime.engine(CONFIG), {'id':'a'*32, 'config':CONFIG}, seed, pages)
        self.assertIsNone(result['rows'][0]['your_score'])
        self.assertIsNone(result['rows'][0]['gap'])
        self.assertTrue(result['rows'][0]['verdict'].startswith('INSUFFICIENT'))

    def test_fanout_normalizes_without_persistent_cache(self):
        self.assertEqual(runtime.distinct_queries(['Giá thay pin?', ' Giá thay pin? ', 'Bảo hành pin?']),
                         ['Giá thay pin?', 'Bảo hành pin?'])

    def test_comparison_requires_query_evidence_even_when_vector_is_close(self):
        q = 'Giá thay pin iPhone?'
        pages = {
            CONFIG['my_url']: {'chunks': ['Giá thay pin iPhone là 800.000 đồng.'], 'vectors': [[.8, .2]]},
            SERP['organic'][0]: {'chunks': ['Điều khoản Ceramic Shield và sửa màn hình.'], 'vectors': [[1., 0.]]},
        }
        seed = {'queries': [q], 'vectors': [[1., 0.]], 'serp': SERP}
        result = runtime.replay(runtime.engine(CONFIG), {'id': 'a'*32, 'config': CONFIG}, seed, pages)
        self.assertIsNone(result['rows'][0]['gap'])
        self.assertEqual(result['passages'][q]['rivals'], [])

    def test_passages_survive_without_navigation_and_keep_words_whole(self):
        ns = runtime.engine(CONFIG)
        text = ns['_extract']('<nav>Danh mục sản phẩm</nav><main><h2>Giá thay pin</h2><p>' + 'Thông tin bảo hành. '*80 + '</p></main>')
        chunks = ns['chunk_text'](text)
        self.assertNotIn('Danh mục', text)
        self.assertTrue(chunks[0].startswith('Giá thay pin'))
        self.assertEqual(' '.join(chunks), ' '.join(text.split()))
        self.assertTrue(all(len(c) <= 700 for c in chunks))

    def test_notebook_source_bodies_are_verbatim_when_available(self):
        source = Path(os.environ.get('AIO_SOURCE_NOTEBOOK', '.ux-baseline/aio/source.ipynb'))
        if not source.exists(): self.skipTest('Optional original notebook not on this machine')
        original = {}
        for cell in json.loads(source.read_text())['cells']:
            if cell['cell_type'] != 'code': continue
            try: tree = ast.parse(''.join(cell['source']))
            except SyntaxError: continue
            for node in tree.body:
                if isinstance(node, ast.FunctionDef): original[node.name] = node
        selected = ast.parse(Path('aio_engine/notebook.py').read_text())
        for node in selected.body:
            if isinstance(node, ast.FunctionDef):
                self.assertEqual(ast.dump(node), ast.dump(original[node.name]), node.name)

    def test_core_edge_rules(self):
        ns = runtime.engine(CONFIG)
        self.assertEqual(ns['chunk_text'](''), [])
        self.assertEqual(ns['cosine']([], [1, 2]), 0)
        self.assertEqual(ns['best_match']([1, 2], []), (0, -1))
        for size, spread, gap, prefix in [(2, 1, 1, 'LOW'), (3, .02, .01, 'PARITY'), (3, 1, -.15, 'AHEAD'), (3, 1, .149, 'PARITY'), (3, 1, .15, 'BEHIND - close'), (3, 1, .5, 'BEHIND - clear')]:
            self.assertTrue(ns['verdict']({'field_size': size, 'spread': spread, 'gap': gap}).startswith(prefix))

    def test_rank_export_roundtrip_and_formula_safety(self):
        with patch('sys.stdout', new=io.StringIO()): result = fixture_result()
        rows = [{'door': door['representative'], 'rank': 1 if i == 0 else '', 'ranking_url': CONFIG['my_url'] if i == 0 else ''} for i, door in enumerate(result['doors'])]
        calculated = runtime.rank_analysis(result, rows)
        self.assertEqual(calculated['k'], 1)
        self.assertAlmostEqual(calculated['probability'], 1-.91**2)
        data = runtime.rank_file(result, rows)
        self.assertEqual(runtime.import_ranks(result, data), calculated)
        import openpyxl
        workbook = openpyxl.load_workbook(io.BytesIO(data))
        self.assertEqual(workbook['Ranks'].freeze_panes, 'A2')
        self.assertTrue(workbook['Ranks'].column_dimensions['D'].hidden)
        literal = copy.deepcopy(result)
        old_door = literal['doors'][0]['representative']
        literal['doors'][0]['representative'] = '=1+1'
        next(row for row in literal['rows'] if row['door'] == old_door)['door'] = '=1+1'
        template = runtime.rank_file(literal)
        self.assertEqual(openpyxl.load_workbook(io.BytesIO(template))['Ranks']['A2'].data_type, 's')

    def test_rank_validation_context_and_url_rules(self):
        with patch('sys.stdout', new=io.StringIO()): result = fixture_result()
        rows = [{'door': door['representative'], 'rank': '', 'ranking_url': ''} for door in result['doors']]
        for invalid in [rows[:-1], rows + [rows[0]], [{**row, 'keyword': 'khác'} for row in rows], [{**rows[0], 'rank': 2.5}] + rows[1:], [{**rows[0], 'rank': True}] + rows[1:], [{**rows[0], 'ranking_url': CONFIG['my_url']}] + rows[1:], [{**rows[0], 'rank': 1, 'ranking_url': 'https://foreign.example/a'}] + rows[1:]]:
            with self.assertRaises(ValueError): runtime.rank_analysis(result, invalid)
        valid = [{**rows[0], 'rank': 101, 'ranking_url': 'http://www.example.com/target/#section'}] + rows[1:]
        # Original notebook accepts all positive integer ranks, including 101.
        analysis = runtime.rank_analysis(result, valid)
        self.assertEqual(analysis['k'], 1)
        self.assertEqual(next(r for r in analysis['rows'] if r['door'] == rows[0]['door'])['url_match'], 'CORRECT TARGET')

    def test_every_action_category_is_preserved(self):
        result = {'id': 'a'*32, 'config': CONFIG, 'doors': [{'representative': f'd{i}'} for i in range(6)],
                  'rows': [{'door': f'd{i}', 'verdict': 'BEHIND' if i in (1, 3, 5) else 'PARITY', 'gap': i/10} for i in range(6)]}
        rows = [{'door': f'd{i}', 'rank': 4 if i < 4 else None, 'ranking_url': CONFIG['my_url'] if i < 2 else 'https://example.com/other' if i < 4 else ''} for i in range(6)]
        output = runtime.rank_analysis(result, rows)
        self.assertEqual([r['action'][0] for r in output['rows']], list('123456'))


class StagedWorkflow(unittest.TestCase):
    def test_same_keyword_starts_fresh_generation_each_time(self):
        store = MemoryStore()
        keys = {'gemini': 'test-key', 'serp': 'test-serp'}
        first = runtime.start(store, CONFIG, keys)
        second = runtime.start(store, CONFIG, keys)
        calls = []
        factory = runtime.engine
        def fake_engine(config, credentials):
            ns = factory(config)
            def generate(keyword, count):
                calls.append((keyword, count))
                return [f'{keyword} · lượt {len(calls)}']
            ns.update(generate_fanout=generate, fetch_serp=lambda *_: {'organic': [], 'aio_citations': []})
            ns['embed_batch'] = lambda texts, **_: [np.array([1., 0.], dtype='float32') for _ in texts]
            return ns
        with patch.object(runtime, 'engine', side_effect=fake_engine):
            runtime.step(store, first['id'], keys)
            runtime.step(store, second['id'], keys)
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual(len(calls), 2)
        self.assertNotEqual(store.artifact(first['id'], 'fanout')['queries'],
                            store.artifact(second['id'], 'fanout')['queries'])
        self.assertEqual(store.cached, {})

    def test_pause_resume_matches_replay_and_never_saves_keys(self):
        store = MemoryStore()
        keys = {'gemini': 'not-a-real-gemini-key', 'serp': 'not-a-real-serp-key'}
        state = runtime.start(store, CONFIG, keys)
        factory = runtime.engine
        def fake_engine(config, credentials):
            ns = factory(config)
            ns.update(generate_fanout=lambda *_: QUERIES, fetch_serp=lambda *_: SERP,
                      fetch_page_text=lambda url: url, chunk_text=lambda url, *_: PAGES[url]['chunks'])
            ns['embed_batch'] = lambda texts, **_: [np.asarray(v, dtype='float32') for v in (VECTORS if texts == QUERIES else next(p['vectors'] for p in PAGES.values() if p['chunks'] == texts))]
            return ns
        with patch.object(runtime, 'engine', side_effect=fake_engine):
            state = runtime.step(store, state['id'], keys)
            self.assertEqual(state['stage'], 'pages')
            self.assertEqual(state['page_index'], 0)
            for i in range(len(state['urls'])):
                state = runtime.step(store, state['id'], keys)
                self.assertEqual(state['page_index'], i+1)
            self.assertEqual(state['stage'], 'score')
            state = runtime.step(store, state['id'], keys)
            self.assertEqual(state['stage'], 'done')
        with patch('sys.stdout', new=io.StringIO()): expected = fixture_result()
        reviewed = store.artifact(state['id'], 'result')['rows']
        for actual, baseline in zip(reviewed, expected['rows'], strict=True):
            self.assertEqual({k: v for k, v in actual.items() if k not in ('reason', 'evidence_label')}, baseline)
        self.assertEqual(store.cached, {})
        persisted = json.dumps([store.states, list(store.artifacts.values()), store.cached])
        for key in keys.values(): self.assertNotIn(key, persisted)

    def test_request_deadline_returns_retryable_checkpoint_and_resumes(self):
        store = MemoryStore()
        keys = {'gemini': 'test-key', 'serp': 'test-serp'}
        state = runtime.start(store, CONFIG, keys)
        ns = runtime.engine(CONFIG)
        ns['generate_fanout'] = lambda *_: QUERIES
        def pause(*_, **__):
            raise runtime.StepDeadline('saved')
        ns['embed_batch'] = pause
        with patch.object(runtime, 'engine', return_value=ns):
            response, filename = dispatch(store, {'action': 'step', 'id': state['id'], 'credentials': keys})
        self.assertEqual(response['stage'], 'fanout')
        self.assertEqual(response['error'], '')
        self.assertGreaterEqual(response['retry_after'], 1)
        self.assertNotIn(state['id'], store.leased)
        ns['embed_batch'] = lambda _, **kwargs: [np.array(v, dtype='float32') for v in VECTORS]
        ns['fetch_serp'] = lambda _: SERP
        with patch.object(runtime, 'engine', return_value=ns):
            response = runtime.step(store, state['id'], keys)
        self.assertEqual(response['stage'], 'pages')
        self.assertNotIn('retry_after', response)

    def test_failed_step_is_retryable_and_scrubs_credentials(self):
        store = MemoryStore(); keys = {'gemini': 'private-test-key', 'serp': 'test-serp'}
        state = runtime.start(store, CONFIG, keys)
        fake = runtime.engine(CONFIG)
        exec("def generate_fanout(*args):\n print('upstream private-test-key')\n raise RuntimeError('Failure private-test-key')", fake)
        with patch.object(runtime, 'engine', return_value=fake), self.assertRaises(RuntimeError): runtime.step(store, state['id'], keys)
        stored = store.read(state['id'])
        self.assertEqual(stored['stage'], 'fanout')
        self.assertNotIn(keys['gemini'], json.dumps(stored))
        self.assertIn('[ẩn]', stored['error'])
        self.assertIn('upstream [ẩn]', stored['logs'])
        self.assertNotIn(state['id'], store.leased)

    def test_page_prefetch_is_parallel_ordered_and_reused_on_resume(self):
        store = MemoryStore()
        urls = list(PAGES)[:3]
        state = {'id': 'a'*32, 'page_index': 0, 'urls': urls}
        ns = runtime.engine(CONFIG)
        barrier = threading.Barrier(3)
        calls = []
        def fetch(url):
            calls.append(url)
            barrier.wait(timeout=5)
            return url
        ns.update(fetch_page_text=fetch, chunk_text=lambda url, *_: PAGES[url]['chunks'])
        self.assertEqual(runtime.page_chunks(ns, store, state), PAGES[urls[0]]['chunks'])
        self.assertCountEqual(calls, urls)
        # A paused embedding step must reuse the same content, even if the site changes.
        ns['fetch_page_text'] = lambda _: self.fail('A saved page was downloaded twice')
        self.assertEqual(runtime.page_chunks(ns, store, state), PAGES[urls[0]]['chunks'])
        state['page_index'] = 1
        self.assertEqual(runtime.page_chunks(ns, store, state), PAGES[urls[1]]['chunks'])

    def test_page_prefetch_covers_later_pages_before_embedding(self):
        store = MemoryStore()
        urls = [f'https://example.com/page-{i}' for i in range(8)]
        state = {'id': 'a'*32, 'page_index': 0, 'urls': urls}
        ns = runtime.engine(CONFIG)
        seen = []
        ns.update(fetch_page_text=lambda url: seen.append(url) or url,
                  chunk_text=lambda url, *_: [url])
        self.assertEqual(runtime.page_chunks(ns, store, state), [urls[0]])
        self.assertCountEqual(seen, urls)
        state['page_index'] = 7
        ns['fetch_page_text'] = lambda _: self.fail('A prefetched page was downloaded twice')
        self.assertEqual(runtime.page_chunks(ns, store, state), [urls[7]])

    def test_failed_target_is_fatal_and_failed_rival_is_skipped(self):
        ns = runtime.engine(CONFIG)
        ns['print'] = lambda *_: None
        def fail(_): raise RuntimeError('unreadable')
        ns['fetch_page_text'] = fail
        state = {'id': 'a'*32, 'page_index': 0, 'urls': list(PAGES)[:2]}
        with self.assertRaisesRegex(RuntimeError, 'trang mục tiêu'):
            runtime.page_chunks(ns, MemoryStore(), state)
        state['page_index'] = 1
        self.assertEqual(runtime.page_chunks(ns, MemoryStore(), state), [])

    def test_embedding_deduplicates_only_current_request(self):
        call = Mock(return_value=SimpleNamespace(embeddings=[SimpleNamespace(values=[1., 2.])]))
        client = SimpleNamespace(models=SimpleNamespace(embed_content=call))
        first = embeddings.embed(['same', 'same'], client, 'model', Mock(), Mock())
        embeddings.embed(['same'], client, 'model', Mock(), Mock())
        self.assertEqual(call.call_count, 2)
        self.assertEqual(call.call_args_list[0].kwargs['contents'], ['same'])
        np.testing.assert_array_equal(first[0], first[1])

    def test_completed_embedding_batches_are_not_charged_again_after_failure(self):
        error = RuntimeError('RequestsPerDay limit: 0')
        error.code = 429
        first = SimpleNamespace(embeddings=[SimpleNamespace(values=[1., 0.]), SimpleNamespace(values=[0., 1.])])
        call = Mock(side_effect=[first, error, SimpleNamespace(embeddings=[SimpleNamespace(values=[.5, .5])])])
        client = SimpleNamespace(models=SimpleNamespace(embed_content=call))
        checkpoint = {}
        with self.assertRaisesRegex(RuntimeError, 'RequestsPerDay'):
            embeddings.embed(['one', 'two', 'three'], client, 'model', Mock(), Mock(), batch=2,
                             on_batch=lambda values: checkpoint.update(values))
        self.assertEqual(set(checkpoint), {'one', 'two'})
        resumed = embeddings.embed(['one', 'two', 'three'], client, 'model', Mock(), Mock(), batch=2, known=checkpoint)
        self.assertEqual(call.call_count, 3)
        self.assertEqual(call.call_args.kwargs['contents'], ['three'])
        np.testing.assert_array_equal(resumed[0], checkpoint['one'])

    def test_next_page_reuses_only_exact_text_from_same_audit(self):
        text = 'Giá thay pin iPhone là 800.000 đồng và bảo hành trong 12 tháng.'
        job = 'a' * 32
        urls = [CONFIG['my_url'], SERP['organic'][0]]
        store = MemoryStore()
        store.create(job, {'id': job, 'config': CONFIG, 'stage': 'pages', 'page_index': 1,
                           'urls': urls, 'logs': [], 'error': '', 'progress': 40})
        store.artifact(job, 'seed', {'queries': ['Giá thay pin iPhone?'], 'vectors': [[.1, .9]], 'serp': SERP})
        store.artifact(job, 'page-0', {'chunks': [text], 'vectors': [[.8, .2]], 'readable': True})
        ns = runtime.engine(CONFIG)
        calls = []
        ns.update(fetch_page_text=lambda _: text, chunk_text=lambda *_: [text])
        def embed(texts, **kwargs):
            calls.append((texts, kwargs['known']))
            return [np.asarray(kwargs['known'][value], dtype='float32') for value in texts]
        ns['embed_batch'] = embed
        with patch.object(runtime, 'engine', return_value=ns):
            runtime.step(store, job, {'gemini': 'key', 'serp': 'key'})
        self.assertEqual(calls[0][1][text], [.8, .2])
        np.testing.assert_allclose(store.artifact(job, 'page-1')['vectors'], [[.8, .2]])

    def test_embedding_errors_keep_provider_cause_and_do_not_retry_bad_key(self):
        error = RuntimeError('API key is invalid')
        error.code = 403
        call = Mock(side_effect=error)
        client = SimpleNamespace(models=SimpleNamespace(embed_content=call))
        with self.assertRaisesRegex(RuntimeError, '403.*API key is invalid'):
            embeddings.embed(['a'], client, 'model', Mock(), Mock())
        self.assertEqual(call.call_count, 1)

    def test_embedding_retries_transient_error_and_rejects_incomplete_output(self):
        error = RuntimeError('unavailable')
        error.code = 503
        call = Mock(side_effect=[error, SimpleNamespace(embeddings=[SimpleNamespace(values=[1., 2.])])])
        client = SimpleNamespace(models=SimpleNamespace(embed_content=call))
        sleep = Mock()
        embeddings.embed(['a'], client, 'model', sleep, Mock())
        sleep.assert_called_once_with(2)
        call.side_effect = None
        call.return_value = SimpleNamespace(embeddings=[])
        with self.assertRaisesRegex(RuntimeError, 'không hợp lệ'):
            embeddings.embed(['a'], client, 'model', sleep, Mock())

    def test_embedding_daily_quota_has_no_retry_loop(self):
        error = RuntimeError('RESOURCE_EXHAUSTED RequestsPerDay limit: 0')
        error.code = 429
        client = SimpleNamespace(models=SimpleNamespace(embed_content=Mock(side_effect=error)))
        sleep = Mock()
        with self.assertRaisesRegex(RuntimeError, 'RequestsPerDay'):
            embeddings.embed(['a'], client, 'model', sleep, Mock())
        sleep.assert_not_called()

    def test_daily_quota_stops_instead_of_retrying_every_minute(self):
        budget = runtime.RequestBudget()
        with patch.object(runtime.time, 'sleep') as sleep:
            with self.assertRaisesRegex(RuntimeError, 'hết quota'):
                budget.sleep(54562)
            sleep.assert_not_called()


class SecurityAndAPI(unittest.TestCase):
    def test_project_billing_error_is_explained(self):
        message = runtime.explain_error('403 PERMISSION_DENIED: The Gemini API free tier is not available for this project.')
        self.assertIn('bật thanh toán', message)
        self.assertIn('project khác', message)
        self.assertEqual(runtime.explain_error('other error'), 'other error')

    def test_public_urls_only_and_dns_rebinding_guard(self):
        for url in ['file:///etc/passwd', 'http://localhost', 'http://a.local', 'https://user:pass@example.com']:
            with self.assertRaises(ValueError): security.public_address(url)
        for ips in [['127.0.0.1'], ['10.0.0.1'], ['169.254.169.254'], ['::1'], ['93.184.216.34', '192.168.1.2']]:
            answers = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443)) for ip in ips]
            with patch.object(socket, 'getaddrinfo', return_value=answers), self.assertRaises(ValueError): security.public_address('https://example.com')
        with patch.object(socket, 'getaddrinfo', return_value=[(2, 1, 6, '', ('93.184.216.34', 443))]):
            self.assertEqual(security.public_address('https://example.com/a')[1], '93.184.216.34')
        def dns(host, *_args, **_kwargs): return [(2, 1, 6, '', ('127.0.0.1' if host == '127.0.0.1' else '93.184.216.34', 443))]
        with patch.object(socket, 'getaddrinfo', side_effect=dns), self.assertRaises(ValueError): security.public_address('https://r.jina.ai/http://127.0.0.1/admin')

    def test_http_endpoint_requires_auth_and_same_origin(self):
        def request(body, headers):
            h = object.__new__(handler); h.headers = Message(); h.rfile = io.BytesIO(body); output = []
            for key, value in {'Host': 'workspace.test', 'Content-Length': str(len(body)), **headers}.items(): h.headers[key] = value
            h.send = lambda status, data, filename=None: output.append((status, data, filename))
            h.do_POST(); return output[0]
        with patch('api.aio.Store') as store:
            self.assertEqual(request(b'{}', {})[0], 401); store.assert_not_called()
            self.assertEqual(request(b'{}', {'Authorization': 'Bearer test', 'Origin': 'https://evil.test'})[0], 401); store.assert_not_called()
            self.assertEqual(request(b'[]', {'Authorization': 'Bearer test'})[0], 400); store.assert_not_called()
            store.return_value = MemoryStore()
            payload = {'action': 'start', 'config': CONFIG, 'credentials': {'gemini': 'test', 'serp': 'test'}}
            response = request(json.dumps(payload).encode(), {'Authorization': 'Bearer test', 'Origin': 'https://workspace.test'})
            self.assertEqual(response[0], 200)
            self.assertEqual(response[1]['stage'], 'fanout')

    def test_owner_scoped_storage_and_no_service_role(self):
        store = object.__new__(Store); store.owner = 'user-one'; calls = []
        def send(method, path, **kwargs):
            calls.append((method, path, kwargs))
            return type('Response', (), {'content': gzip.compress(json.dumps({'ok': True}).encode())})()
        store.request = send
        store.artifact('job', 'result', {'ok': True})
        self.assertIn('/seo-aio/user-one/job/result.json.gz', calls[0][1])
        self.assertEqual(store.artifact('job', 'result'), {'ok': True})
        sql = Path('supabase/migrations/20261105000002_aio_workspace.sql').read_text()
        self.assertIn('enable row level security', sql)
        self.assertIn('security invoker', sql)
        self.assertIn('auth.uid()', sql)
        self.assertNotIn('service_role', Path('aio_engine/storage.py').read_text())
        import base64
        secret = 'login:private-test'
        self.assertEqual(runtime.redact(base64.b64encode(secret.encode()).decode(), {'serp': secret}), '[ẩn]')
        first, second = runtime.engine(CONFIG), runtime.engine(CONFIG)
        first['_EMB_CACHE']['test'] = np.array([1])
        self.assertNotIn('test', second['_EMB_CACHE'])

    def test_invalid_config_and_job_are_rejected(self):
        for config in [None, [], {**CONFIG, 'n_queries': True}, {**CONFIG, 'n_queries': 31}, {**CONFIG, 'threshold': .1}, {**CONFIG, 'provider': 'injected'}, {**CONFIG, 'my_url': 'file:///root'}, {**CONFIG, 'llm_model': 'bad?apikey=private'}]:
            with self.assertRaises(ValueError): runtime.validate_config(config)
        for payload in [{'action': 'status', 'id': '../user/result'}, {'action': 'step', 'id': 'a'*32, 'credentials': {'gemini': []}}]:
            with self.assertRaises(ValueError): dispatch(MemoryStore(), payload)


if __name__ == '__main__': unittest.main()

class StorageMissingObject(unittest.TestCase):
    def test_storage_400_not_found_is_cache_miss_only(self):
        store = object.__new__(Store)
        store.base = 'https://example.supabase.co'
        store.headers = {}
        from unittest.mock import Mock
        response = Mock(status_code=400)
        response.json.return_value = {'statusCode': '404', 'error': 'not_found', 'message': 'Object not found'}
        with patch('aio_engine.storage.requests.request', return_value=response):
            with self.assertRaises(FileNotFoundError):
                store.request('GET', '/storage/v1/object/seo-aio/owner/job/fanout.json.gz')
            with self.assertRaises(RuntimeError):
                store.request('POST', '/storage/v1/object/seo-aio/owner/job/fanout.json.gz')
            response.json.return_value = {'error': 'InvalidRequest', 'message': 'bad payload'}
            with self.assertRaises(RuntimeError):
                store.request('GET', '/storage/v1/object/seo-aio/owner/job/fanout.json.gz')
