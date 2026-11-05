# Ported from aio_dtv.ipynb. Calculation bodies are retained verbatim; no Gradio/Colab code.
import os, json, time, re, math, traceback, unicodedata, hashlib, tempfile, uuid
from pathlib import Path
from urllib.parse import urlsplit
import html as _htmlmod
import numpy as np
import pandas as pd
import requests
from google import genai
COUNTRY, LANGUAGE, LOCATION, GEN_LANG = 'vn', 'vi', 'Vietnam', 'Vietnamese'
LLM_MODEL, EMBED_MODEL = 'gemini-3.8-flash', 'gemini-embedding-001'
N_QUERIES, DOOR_THRESHOLD, TOP_N_COMPETITORS = 15, 0.85, 10
MAX_CHARS, OVERLAP_CHARS, RETRY_503_DELAY = 1800, 200, 2
SERP_PROVIDER, SERP_API_KEY, client = 'serper', '', None
_embed_log, _EMB_CACHE = [], {}


def _is_503(e):
    return getattr(e, "code", None) == 503 or "UNAVAILABLE" in str(e)

def _retry_503(fn, delay=RETRY_503_DELAY):
    """Gọi fn(). Nếu Gemini trả lỗi 503 thì chờ `delay` giây rồi gọi lại, lặp tới khi thành công.
    Lỗi khác 503 (429, 400...) vẫn raise như cũ để code bên dưới xử lý."""
    n = 0
    while True:
        try:
            return fn()
        except Exception as e:
            if not _is_503(e):
                raise
            n += 1
            print(f"  ⚠️ Gemini 503 — thử lại sau {delay}s (lần {n})")
            time.sleep(delay)

def strip_diacritics(s: str) -> str:
    """máy tính -> may tinh. Vietnamese users search both forms."""
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")

def chunk_text(text, max_chars=1200, overlap_chars=200):
    """Split on sentence boundaries with overlap. NOTE the single-backslash \\s —
    the WordLift notebook had r'\\\\s+' which never matches whitespace."""
    if not text or not text.strip():
        return []
    text = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.!?…])\s+", text)
    chunks, cur = [], ""
    for s in sentences:
        if len(cur) + len(s) + 1 > max_chars and cur:
            chunks.append(cur.strip())
            cur = cur[-overlap_chars:] if overlap_chars else ""
        cur += (" " if cur else "") + s
    if cur.strip():
        chunks.append(cur.strip())
    return [c for c in chunks if len(c) > 40]

def cosine(a, b):
    a, b = np.asarray(a, dtype="float32"), np.asarray(b, dtype="float32")
    if a.size == 0 or b.size == 0:
        return 0.0
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return 0.0 if na == 0 or nb == 0 else float(np.dot(a, b) / (na * nb))

def best_match(qvec, chunk_vecs):
    """Return (best_score, best_index). -1 index if nothing to compare."""
    if not chunk_vecs:
        return 0.0, -1
    scores = [cosine(qvec, cv) for cv in chunk_vecs]
    i = int(np.argmax(scores))
    return float(scores[i]), i

def cluster_doors(queries, qvecs, threshold=0.85):
    """Greedy agglomerative clustering. 20 generated queries -> ~7 distinct doors.
    Returns list of dicts: {representative, members, member_indices}."""
    n = len(queries)
    assigned = [-1] * n
    clusters = []
    for i in range(n):
        if assigned[i] != -1:
            continue
        cid = len(clusters)
        assigned[i] = cid
        members = [i]
        for j in range(i + 1, n):
            if assigned[j] == -1 and cosine(qvecs[i], qvecs[j]) >= threshold:
                assigned[j] = cid
                members.append(j)
        clusters.append({
            "representative": queries[i],
            "members": [queries[m] for m in members],
            "member_indices": members,
        })
    return clusters

def score_door(door_vec, my_vecs, competitor_vecs_by_url):
    """Comparative, not absolute. Reports where you sit in the field and how
    wide the field is — a narrow field means the ranking is noise."""
    my_score, my_idx = best_match(door_vec, my_vecs)
    comp = sorted(((u, best_match(door_vec, v)[0])
                   for u, v in competitor_vecs_by_url.items()), key=lambda x: -x[1])
    field = np.array([my_score] + [s for _, s in comp], dtype="float32")
    std = float(field.std())
    return {
        "my_score": round(my_score, 4),
        "my_chunk_index": my_idx,
        "best_competitor": comp[0][0] if comp else None,
        "best_competitor_score": round(comp[0][1], 4) if comp else None,
        "my_rank": sum(1 for _, s in comp if s > my_score) + 1,
        "field_size": len(comp) + 1,
        "gap": round(comp[0][1] - my_score, 4) if comp else None,
        "z": round(float((my_score - field.mean()) / std), 2) if std > 1e-6 else 0.0,
        "spread": round(float(field.max() - field.min()), 4),
    }

def verdict(row):
    """Measured against the LEADER, not the field mean. Using the mean lets two weak
    rivals drag it down so that a 2nd-place page reads as 'ahead' — verified failure."""
    if row["field_size"] < 3:
        return "LOW CONFIDENCE - too few rivals fetched"
    if row["spread"] < 0.03:
        return "PARITY - field indistinguishable, ignore"
    rel = row["gap"] / row["spread"]        # gap = best_rival - you ; negative = you lead
    if rel <= -0.15: return "AHEAD - clear leader"
    if rel <   0.15: return "PARITY - too close to call"
    if rel <   0.50: return "BEHIND - close, small rewrite wins"
    return "BEHIND - clear gap, rewrite this block"

FANOUT_PROMPT = """You are simulating Google AI Mode's query fan-out for the {country} market.

The user searched: "{keyword}"

Google internally expands this into multiple synthetic sub-queries covering different FACETS of the
topic, then retrieves passages for each. Your job is to predict those sub-queries.

Generate exactly {n} sub-queries in {lang}. They must be GENUINELY DISTINCT facets, not rephrasings.
Rephrasings are worthless here — "giá CRM" and "CRM giá bao nhiêu" are the SAME facet.

Cover this spread where it applies to the topic:
- definitional / what-is
- pricing and cost
- how-to / practical steps
- comparison against named alternatives
- drawbacks, risks, limitations
- real user experience and reviews
- requirements, compatibility, integration
- recency: current state as of {date}
- local specifics for {country_name} (regulation, availability, local providers, local pricing)

Return ONLY a JSON array of strings. No prose, no markdown fence."""

def generate_fanout(keyword, n=N_QUERIES):
    import datetime
    prompt = FANOUT_PROMPT.format(
        keyword=keyword, n=n, lang=GEN_LANG, country=COUNTRY.upper(),
        country_name=LOCATION, date=datetime.date.today().strftime("%B %Y"))
    resp = _retry_503(lambda: client.models.generate_content(
        model=LLM_MODEL, contents=[prompt],
        config={"temperature":0.7, "max_output_tokens":8000},   # generous: truncation ruins this
    ))
    raw = (resp.text or "").strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.M).strip()
    try:
        qs = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\[.*\]", raw, re.S)
        if not m:
            raise RuntimeError(f"Could not parse fan-out output:\n{raw[:500]}")
        qs = json.loads(m.group(0))
    qs = [str(q).strip() for q in qs if str(q).strip()]
    if not qs:
        raise RuntimeError("Fan-out returned zero queries.")
    print(f"🔍 Generated {len(qs)} candidate queries")
    return qs

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

MANUAL_AIO_CITATIONS = []

def clean(s):
    """Colab #@param fields often keep the quote marks people paste in."""
    return str(s).strip().strip('"').strip("'").strip()

def _extract(html):
    """Visible text from raw HTML. Decodes entities — without this, Vietnamese
    diacritics served as á / ô reach the embedder as garbage and
    systematically understate any site that serves them."""
    html = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header|form)[^>]*>.*?</\1>", " ", html)
    m = re.search(r"(?is)<(?:main|article)[^>]*>(.*?)</(?:main|article)>", html)
    if m: html = m.group(1)
    t = re.sub(r"(?s)<[^>]+>", " ", html)
    t = _htmlmod.unescape(t)                      # ← the fix
    return re.sub(r"\s+", " ", t).strip()

def fetch_page_text(url, timeout=30):
    """Direct fetch, then a JS-rendering reader proxy. NEVER falls back to the page
    title — that silent fallback is what makes other fan-out tools report fake scores."""
    hdrs = {"User-Agent": UA, "Accept-Language": f"{LANGUAGE},vi;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml"}
    text = ""
    try:
        r = requests.get(url, headers=hdrs, timeout=timeout)
        if r.status_code == 200:
            if not r.encoding or r.encoding.lower() in ("iso-8859-1", "latin-1"):
                r.encoding = r.apparent_encoding or "utf-8"
            text = _extract(r.text)
    except Exception:
        pass
    if len(text) < 300:                            # JS-rendered or blocked
        try:
            r = requests.get(f"https://r.jina.ai/{url}",
                             headers={"User-Agent": UA}, timeout=60)
            if r.status_code == 200:
                text = re.sub(r"\s+", " ", _htmlmod.unescape(r.text)).strip()
        except Exception:
            pass
    if len(text) < 300:
        raise RuntimeError(f"unreadable ({len(text)} chars)")
    return text

def fetch_serp(keyword):
    keyword = clean(keyword)
    manual  = list(MANUAL_AIO_CITATIONS)
    if SERP_PROVIDER == "none":
        return {"organic": [], "aio_citations": manual}

    if SERP_PROVIDER == "serper":
        r = requests.post("https://google.serper.dev/search",
            headers={"X-API-KEY": SERP_API_KEY, "Content-Type": "application/json"},
            json={"q": keyword, "gl": COUNTRY, "hl": LANGUAGE, "num": 10}, timeout=30)
        if r.status_code != 200:
            print(f"❌ Serper {r.status_code} → {r.text[:400]}")
            r.raise_for_status()
        d = r.json()
        organic = [x["link"] for x in d.get("organic", []) if x.get("link")]
        aio = []
        for key in ("aiOverview", "answerBox"):
            blk = d.get(key) or {}
            for ref in (blk.get("references") or blk.get("sources") or []):
                u = ref.get("link") or ref.get("url")
                if u: aio.append(u)

    elif SERP_PROVIDER == "serpapi":
        r = requests.get("https://serpapi.com/search", timeout=30, params={
            "q": keyword, "gl": COUNTRY, "hl": LANGUAGE, "location": LOCATION,
            "api_key": SERP_API_KEY, "num": 10})
        r.raise_for_status(); d = r.json()
        organic = [x["link"] for x in d.get("organic_results", []) if x.get("link")]
        aio = [ref.get("link") for ref in
               (d.get("ai_overview", {}) or {}).get("references", []) if ref.get("link")]

    elif SERP_PROVIDER == "dataforseo":
        import base64
        auth = base64.b64encode(SERP_API_KEY.encode()).decode()
        r = requests.post(
            "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
            headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
            json=[{"keyword": keyword, "location_name": LOCATION,
                   "language_code": LANGUAGE, "depth": 20}], timeout=60)
        r.raise_for_status()
        items = r.json()["tasks"][0]["result"][0]["items"]
        organic = [i["url"] for i in items if i.get("type") == "organic" and i.get("url")]
        aio = [ref["url"] for i in items if i.get("type") in ("ai_overview", "generative_answer")
               for ref in (i.get("references") or []) if ref.get("url")]
    else:
        raise ValueError(f"Unknown SERP_PROVIDER: {SERP_PROVIDER}")

    aio = list(dict.fromkeys(manual + aio))
    print(f"🔎 {len(organic)} organic · {len(aio)} AIO citations"
          + (f" ({len(manual)} pasted manually)" if manual else ""))
    return {"organic": organic[:TOP_N_COMPETITORS], "aio_citations": aio}

def _throttle(n, limit=90, window=60):
    global _embed_log
    while True:
        now = time.time()
        _embed_log = [t for t in _embed_log if now - t < window]
        if len(_embed_log) + n <= limit:
            break
        wait = window - (now - _embed_log[0]) + 1
        print(f"  ⏳ embed quota — waiting {wait:.0f}s")
        time.sleep(max(1, wait))
    _embed_log.extend([time.time()] * n)

def audit(keyword, my_url, n_queries=N_QUERIES, verbose=True):
    keyword, my_url = clean(keyword), clean(my_url)
    print(f"\n{'='*70}\n🎯 {keyword}\n📄 {my_url}\n🌏 {LOCATION} ({COUNTRY}/{LANGUAGE})\n{'='*70}")

    # 1 — fan-out from the KEYWORD
    queries = generate_fanout(keyword, n_queries)

    # 2 — dedupe into distinct doors
    qvecs = embed_batch(queries)
    keep  = [i for i,v in enumerate(qvecs) if v.size]
    queries, qvecs = [queries[i] for i in keep], [qvecs[i] for i in keep]
    doors = cluster_doors(queries, qvecs, DOOR_THRESHOLD)
    door_vecs = [qvecs[d["member_indices"][0]] for d in doors]
    print(f"🚪 {len(queries)} queries → {len(doors)} distinct doors "
          f"(merged {len(queries)-len(doors)} rephrasings)")

    # 3 — SERP
    serp = fetch_serp(keyword)
    competitor_urls = list(dict.fromkeys(serp["aio_citations"] + serp["organic"]))[:TOP_N_COMPETITORS]
    if serp["aio_citations"]:
        print(f"🤖 AI Overview cites {len(serp['aio_citations'])} sources")
    else:
        print("🤖 No AI Overview detected for this query (or provider does not expose it)")
    print(f"🏁 {len(competitor_urls)} competitor pages")

    # 4 — fetch + chunk + embed everyone
    def load(url):
        try:
            chunks = chunk_text(fetch_page_text(url), MAX_CHARS, OVERLAP_CHARS)
            if not chunks: raise RuntimeError("no usable chunks")
            return chunks
        except Exception as e:
            print(f"  ⚠️ skip {url[:60]} — {e}")
            return []

    my_chunks = load(my_url)
    if not my_chunks:
        raise RuntimeError("Could not read YOUR page. Aborting rather than reporting a fake score.")
    my_vecs = [v for v in embed_batch(my_chunks) if v.size]
    print(f"📄 your page → {len(my_vecs)} chunks")

    comp_vecs, comp_chunks = {}, {}
    for u in competitor_urls:
        if u.rstrip('/') == my_url.rstrip('/'): continue
        ch = load(u)
        if ch:
            comp_chunks[u] = ch
            comp_vecs[u] = [v for v in embed_batch(ch) if v.size]
    # --- centering: strip the shared topic direction ---
    all_vecs = list(door_vecs) + list(my_vecs) + [v for vs in comp_vecs.values() for v in vs]
    mu = np.mean(np.stack(all_vecs), axis=0)
    before = float(np.mean([cosine(door_vecs[0], v) for v in my_vecs]))
    door_vecs = [v - mu for v in door_vecs]
    my_vecs   = [v - mu for v in my_vecs]
    comp_vecs = {u: [v - mu for v in vs] for u, vs in comp_vecs.items()}
    after = float(np.mean([cosine(door_vecs[0], v) for v in my_vecs]))
    print(f"🎯 centered on {len(all_vecs)} vectors "
          f"(sample door mean-sim {before:.3f} → {after:.3f})")
    # 5 — comparative scoring per door
    rows=[]
    for d, dv in zip(doors, door_vecs):
        s = score_door(dv, my_vecs, comp_vecs)
        rows.append({
            "door": d["representative"],
            "merged_variants": len(d["members"]),
            "your_score": s["my_score"],
            "best_rival_score": s["best_competitor_score"],
            "gap": s["gap"],
            "your_rank": f"{s['my_rank']}/{s['field_size']}",
            "spread": s["spread"],
            "verdict": verdict(s),
            "best_rival": (s["best_competitor"] or "")[:60],
            "your_best_passage": (my_chunks[s["my_chunk_index"]][:180] + "…")
                                  if s["my_chunk_index"] >= 0 else "",
        })
    df = pd.DataFrame(rows).sort_values("gap", ascending=False, na_position="last")
    globals().update(LAST_MY_CHUNKS=my_chunks, LAST_MY_VECS=my_vecs,
                     LAST_COMP_CHUNKS=comp_chunks, LAST_COMP_VECS=comp_vecs,
                     LAST_DOORS=doors, LAST_DOOR_VECS=door_vecs)
    return df, doors, competitor_urls

def embed_batch(texts, batch=20):
    out = [None] * len(texts)
    todo, todo_idx = [], []
    for i, t in enumerate(texts):
        t = t[:8000]
        h = hashlib.md5((EMBED_MODEL + "|" + t).encode()).hexdigest()
        if h in _EMB_CACHE: out[i] = _EMB_CACHE[h]
        else: todo.append(t); todo_idx.append((i, h))

    hits = len(texts) - len(todo)
    if hits: print(f"  💾 cache {hits}/{len(texts)} hits — embedding {len(todo)}")
    if not todo: return out

    failed = 0
    for b in range(0, len(todo), batch):
        part, meta = todo[b:b+batch], todo_idx[b:b+batch]
        _throttle(len(part))
        for attempt in range(5):
            try:
                res = _retry_503(lambda: client.models.embed_content(model=EMBED_MODEL, contents=part))
                for (i, h), e in zip(meta, res.embeddings):
                    v = np.array(e.values, dtype="float32"); _EMB_CACHE[h] = v; out[i] = v
                break
            except Exception as e:
                msg = str(e)
                if "RESOURCE_EXHAUSTED" not in msg and "429" not in msg:
                    print(f"  ❌ permanent error: {msg[:110]}")
                    for i, _ in meta: out[i] = np.array([])
                    failed += len(part); break
                m = re.search(r"retryDelay['\"]?:\s*['\"]?(\d+)", msg)
                wait = int(m.group(1)) + 2 if m else min(60, 5 * (attempt + 1))
                if attempt == 4:
                    print(f"  ❌ quota exhausted: {msg[:110]}")
                    for i, _ in meta: out[i] = np.array([])
                    failed += len(part)
                else:
                    print(f"  ⏳ quota hit — retrying in {wait}s"); time.sleep(wait)

    out = [v if v is not None else np.array([]) for v in out]
    assert len(out) == len(texts)
    if failed:
        pct = failed / len(texts)
        print(f"  ⚠️ {failed}/{len(texts)} embeddings failed ({pct:.0%})")
        if pct > 0.20:
            raise RuntimeError(f"{pct:.0%} failed — aborting. Cache holds {len(_EMB_CACHE)} vectors, "
                               f"rerun later and they will be reused.")
    return out

def _compare_data(door_text, n_rivals=2, width=1200):
    """Return passage comparison as Markdown using the latest audit state."""
    if not door_text:
        return "Select a door from the dropdown."

    hits = [i for i, d in enumerate(LAST_DOORS)
            if d["representative"] == door_text]
    if not hits:
        return "Door not found in the latest audit."

    i = hits[0]
    d, dv = LAST_DOORS[i], LAST_DOOR_VECS[i]
    my_score, my_idx = best_match(dv, LAST_MY_VECS)

    ranked = sorted(
        ((u, *best_match(dv, v)) for u, v in LAST_COMP_VECS.items()),
        key=lambda x: -x[1]
    )
    winners = [r for r in ranked if r[1] > my_score][:int(n_rivals)]

    my_passage = LAST_MY_CHUNKS[my_idx][:width] if my_idx >= 0 else "(No matching chunk)"
    parts = [
        f"## {d['representative']}",
        f"### Your page — score `{my_score:.3f}`",
        my_passage,
    ]

    if not winners:
        parts += ["", "✅ **Your page leads this door among the fetched pages.**"]
    else:
        parts += ["", f"### Competitor passages that currently beat yours ({len(winners)})"]
        for rank_no, (url, score, chunk_idx) in enumerate(winners, 1):
            rival_text = LAST_COMP_CHUNKS[url][chunk_idx][:width]
            parts += [
                "",
                f"**#{rank_no} · +{score-my_score:.3f} gap · score `{score:.3f}`**",
                f"{url}",
                rival_text,
            ]

    return "\n\n".join(parts)

RANK_COLUMNS = ["door", "rank", "ranking_url"]

QUEUE_COLUMNS = ["action", "door", "rank", "ranking_url", "url_match", "gap", "verdict"]

def _clear_rank_state():
    for name in ("LAST_RANK_INPUT", "LAST_RANK_RESULTS", "LAST_RANK_SUMMARY",
                 "LAST_RANK_CONTEXT", "ranks", "ranking_urls", "ranked", "k", "total"):
        globals().pop(name, None)

def _door_key(value):
    if value is None or pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(value))).strip().casefold()

def _url_parts(value):
    value = clean(value)
    p = urlsplit(value)
    if p.scheme.lower() not in ("http", "https") or not p.hostname or p.username or p.password:
        raise ValueError(f"URL phải đầy đủ, bắt đầu bằng http:// hoặc https://: {value!r}")
    # Preserve path/query case. Ignore scheme, www and fragment for target matching.
    host = p.hostname.lower().removeprefix("www.")
    port = p.port
    netloc = host + (f":{port}" if port not in (None, 80, 443) else "")
    return host, (netloc, p.path.rstrip("/"), p.query)

def _rank_context(context=None):
    if context is not None:
        if not context or context.get("audit_id") != globals().get("LAST_AUDIT_ID"):
            raise RuntimeError("Phiên audit đã thay đổi. Chạy lại Audit trước khi nhập rank.")
        return context
    audit_df = globals().get("df")
    if audit_df is None or audit_df.empty or not globals().get("LAST_TARGET_URL"):
        raise RuntimeError("Chạy Audit thành công trước khi dùng bước 9.")
    doors = [d["representative"] for d in globals().get("LAST_DOORS", [])]
    if not doors or len({_door_key(d) for d in doors}) != len(doors):
        raise RuntimeError("Danh sách door rỗng hoặc bị trùng. Chạy lại Audit.")
    if {_door_key(d) for d in doors} != {_door_key(d) for d in audit_df["door"]}:
        raise RuntimeError("Door list không khớp kết quả audit. Chạy lại Audit.")
    payload = {"target_url": clean(LAST_TARGET_URL),
               "keyword": globals().get("LAST_KEYWORD", ""),
               "country": COUNTRY, "language": LANGUAGE,
               "doors": sorted(_door_key(d) for d in doors)}
    signature = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return dict(payload, doors=doors, audit_df=audit_df.copy(deep=True),
                audit_signature=signature, audit_id=globals().get("LAST_AUDIT_ID"))

def make_rank_template(context=None):
    context = _rank_context(context)
    return pd.DataFrame({"door": context["doors"],
                         "rank": pd.array([None] * len(context["doors"]), dtype="Int64"),
                         "ranking_url": [""] * len(context["doors"])})

def _column_key(value):
    return re.sub(r"[^a-z0-9]+", "_", strip_diacritics(str(value).strip().lower())).strip("_")

def _normalise_rank_input(value, context=None):
    context = _rank_context(context)
    if value is None:
        raise ValueError("Hiện danh sách door hoặc tải file kết quả lên trước.")
    work = pd.DataFrame(value).copy()
    aliases = {
        "door": "door", "keyword": "door", "query": "door", "tu_khoa": "door",
        "rank": "rank", "position": "rank", "ranking": "rank", "thu_hang": "rank", "vi_tri": "rank",
        "ranking_url": "ranking_url", "url": "ranking_url", "landing_page": "ranking_url",
        "landing_page_url": "ranking_url", "url_xep_hang": "ranking_url",
    }
    keys = [_column_key(c) for c in work.columns]
    # Our export includes both door (sub-query) and keyword (audit target metadata).
    if "door" in keys:
        aliases.pop("keyword")
    work.columns = [aliases.get(key, key) for key in keys]
    if work.columns.duplicated().any():
        raise ValueError("Các cột bị trùng sau khi đổi tên. Chỉ giữ một cột cho mỗi trường.")
    missing_columns = set(RANK_COLUMNS) - set(work.columns)
    if missing_columns:
        raise ValueError("File thiếu cột: " + ", ".join(sorted(missing_columns)) +
                         ". your_rank là điểm audit, không phải rank Google.")
    # Ignore wholly empty spreadsheet rows, never a row with data but no door.
    def has_value(v):
        return v is not None and not pd.isna(v) and str(v).strip() != ""
    work = work[work[RANK_COLUMNS].apply(lambda row: any(has_value(v) for v in row), axis=1)].copy()
    if work.empty:
        raise ValueError("Bảng/file chưa có door.")
    # Exported context is checked when present; foreign scores/verdicts are never used.
    for field in ("target_url", "keyword", "country", "language", "audit_signature"):
        if field in work:
            for val in work[field]:
                if not has_value(val):
                    continue
                if field == "target_url":
                    matches = _url_parts(val)[1] == _url_parts(context[field])[1]
                elif field == "keyword":
                    matches = _door_key(val) == _door_key(context[field])
                else:
                    matches = str(val).strip() == str(context[field]).strip()
                if not matches:
                    raise ValueError(f"{field} trong file không khớp audit hiện tại. Xuất lại mẫu ở bước 9.")
    work["_key"] = work["door"].map(_door_key)
    if (work["_key"] == "").any():
        raise ValueError("Có dòng chứa rank/URL nhưng thiếu door.")
    duplicates = work.loc[work["_key"].duplicated(keep=False), "door"].tolist()
    if duplicates:
        raise ValueError("Door bị trùng, cần giữ đúng một dòng mỗi door: " + repr(duplicates[:3]))
    canonical = {_door_key(d): d for d in context["doors"]}
    unknown = set(work["_key"]) - set(canonical)
    missing = set(canonical) - set(work["_key"])
    if unknown or missing:
        raise ValueError(f"File không khớp danh sách audit: {len(unknown)} door lạ, {len(missing)} door thiếu. "
                         "Giữ đủ door trong file mẫu để total/k không bị sai. "
                         f"Ví dụ: {list(sorted(unknown or missing))[:3]}")
    target_host = _url_parts(context["target_url"])[0]
    rows = {}
    for _, row in work.iterrows():
        door = canonical[row["_key"]]
        raw = row["rank"]
        token = str(raw).strip().casefold() if has_value(raw) else ""
        if token in ("", "n/a", "na", "none", "null", "not found", "not ranked", "no rank", "nr", "-"):
            rank = None
        else:
            try:
                number = float(raw)
            except (ValueError, TypeError):
                raise ValueError(f"Rank không hợp lệ tại {door!r}: {raw!r}")
            if isinstance(raw, (bool, np.bool_)) or not math.isfinite(number) or not number.is_integer() or number < 1:
                raise ValueError(f"Rank phải là số nguyên >= 1 hoặc để trống tại {door!r}: {raw!r}")
            rank = int(number)
        url = str(row["ranking_url"]).strip() if has_value(row["ranking_url"]) else ""
        if rank is None:
            if url:
                raise ValueError(f"Door {door!r} có ranking_url nhưng rank trống/không rank. Kiểm tra lại dòng này.")
        elif url:
            host = _url_parts(url)[0]
            if host != target_host and not host.endswith("." + target_host):
                raise ValueError(f"Ranking URL thuộc domain khác tại {door!r}: {url}")
        rows[row["_key"]] = {"door": door, "rank": rank, "ranking_url": url}
    out = pd.DataFrame([rows[_door_key(d)] for d in context["doors"]], columns=RANK_COLUMNS)
    out["rank"] = pd.array(out["rank"], dtype="Int64")
    return out

def _write_rank_xlsx(table, context):
    table = table.copy()
    for field in ("target_url", "keyword", "country", "language", "audit_signature"):
        table[field] = context[field]
    path = Path(tempfile.mkdtemp(prefix="dtv_step9_")) / "dtv_step9_ranks.xlsx"
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        table.to_excel(writer, index=False, sheet_name="Ranks")
        ws = writer.sheets["Ranks"]
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        for col in ws.columns:
            field = col[0].value
            ws.column_dimensions[col[0].column_letter].width = 60 if field in ("door", "ranking_url") else 22
            # Keep audit identity for validation without cluttering the tracking sheet.
            if field in ("target_url", "keyword", "country", "language", "audit_signature"):
                ws.column_dimensions[col[0].column_letter].hidden = True
            for cell in col:
                if isinstance(cell.value, str) and cell.value.startswith("="):
                    cell.data_type = "s"
    return str(path)

def run_rank_analysis_ui(rank_df, context=None):
    """Step 9B: combine rank, ranking URL, and audit verdict into an action queue."""
    _clear_rank_state()
    try:
        context = _rank_context(context)
        work = _normalise_rank_input(rank_df, context)
        target_url = context["target_url"]
        target_norm = _url_parts(target_url)[1]
        norm_url = lambda u: _url_parts(u)[1]
        ranks = {row.door: (None if pd.isna(row.rank) else int(row.rank)) for row in work.itertuples()}
        ranking_urls = dict(zip(work["door"], work["ranking_url"]))
        audit_df = context["audit_df"]
        verdict_map = dict(zip(audit_df.door, audit_df.verdict))
        gap_map = dict(zip(audit_df.door, audit_df.gap))

        P = lambda k: 1 - 0.91 ** (k + 1)
        total = len(ranks)
        ranked = {d: r for d, r in ranks.items() if r is not None}
        k = len(ranked)

        rows = []

        for d in ranks:
            verdict = verdict_map.get(d, "?")
            behind = str(verdict).startswith("BEHIND")
            r = ranks[d]
            ranking_url = ranking_urls[d]

            if r is None:
                url_match = "N/A"
                if behind:
                    action = "6 · LOW PRIORITY — no rank + target behind"
                else:
                    action = "5 · VISIBILITY — no rank + target competitive"
            else:
                if not ranking_url:
                    url_match = "UNKNOWN"
                    # Preserve conservative classification when ranking URL was not provided.
                    if behind:
                        action = "2 · REWRITE — ranked, URL unknown, target behind"
                    else:
                        action = "1 · WORKING? — ranked, URL unknown"
                else:
                    same_url = norm_url(ranking_url) == target_norm
                    url_match = "CORRECT TARGET" if same_url else "OTHER PAGE"

                    if same_url and not behind:
                        action = "1 · WORKING — correct page + competitive"
                    elif same_url and behind:
                        action = "2 · REWRITE — correct page + behind"
                    elif (not same_url) and not behind:
                        action = "3 · CONSOLIDATE — other page ranks + target competitive"
                    else:
                        action = "4 · REWRITE + CONSOLIDATE — other page ranks + target behind"

            rows.append({
                "action": action,
                "door": d,
                "rank": r,
                "ranking_url": ranking_url,
                "url_match": url_match,
                "gap": gap_map.get(d),
                "verdict": verdict,
            })

        out = pd.DataFrame(rows).sort_values(
            ["action", "gap"],
            ascending=[True, False],
            na_position="last"
        )

        counts = out["action"].value_counts().to_dict()

        summary_lines = [
            "## Step 9 · Rank + URL analysis",
            "",
            f"- **Target URL:** `{target_url}`",
            f"- **k = {k}/{total} doors ranking top-100 at domain level**",
            f"- **P(retrieved) ≈ {P(k):.0%}** *(original notebook formula; treat as a ceiling)*",
            f"- **Next door incremental value ≈ {(P(k+1)-P(k))*100:.1f} pts**",
            "",
            "### Action logic",
            "- **WORKING:** door ranks with the correct target page and target content is competitive.",
            "- **REWRITE:** door ranks with the correct target page but target content is behind.",
            "- **CONSOLIDATE:** another page ranks while the target page is already competitive.",
            "- **REWRITE + CONSOLIDATE:** another page ranks and the target page is also behind.",
            "- **VISIBILITY:** no page ranks for the door, but target content is competitive.",
            "- **LOW PRIORITY:** no page ranks and target content is behind.",
            "",
            "### Counts",
        ]

        ordered_labels = [
            "1 · WORKING — correct page + competitive",
            "1 · WORKING? — ranked, URL unknown",
            "2 · REWRITE — correct page + behind",
            "2 · REWRITE — ranked, URL unknown, target behind",
            "3 · CONSOLIDATE — other page ranks + target competitive",
            "4 · REWRITE + CONSOLIDATE — other page ranks + target behind",
            "5 · VISIBILITY — no rank + target competitive",
            "6 · LOW PRIORITY — no rank + target behind",
        ]
        for label in ordered_labels:
            if counts.get(label, 0):
                summary_lines.append(f"- **{label}:** {counts[label]}")

        summary_text = "\n".join(summary_lines)
        # Commit only after complete validation and successful analysis.
        globals().update(
            LAST_RANK_INPUT=work.copy(deep=True), LAST_RANK_RESULTS=out.copy(deep=True),
            LAST_RANK_SUMMARY=summary_text, LAST_RANK_CONTEXT=context,
            ranks=ranks, ranking_urls=ranking_urls, ranked=ranked, k=k, total=total,
        )
        return summary_text, out, "No error."

    except Exception as e:
        return (
            f"## ❌ Rank analysis failed\n\n**{type(e).__name__}: {str(e)}**",
            pd.DataFrame(columns=[
                "action", "door", "rank", "ranking_url",
                "url_match", "gap", "verdict"
            ]),
            traceback.format_exc(),
        )
