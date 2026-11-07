"""Query-level passage selection for the web audit."""
import re
import textwrap
import unicodedata
from collections import Counter
from html import unescape
from math import log


def article_text(html):
    html = re.sub(r'(?is)<(script|style|noscript|svg|nav|aside|footer|header|form)\b[^>]*>.*?</\1>', ' ', html)
    main = re.search(r'(?is)<(main|article)\b[^>]*>(.*?)</\1>', html)
    html = main.group(2) if main else html
    html = re.sub(r'(?i)</(?:h[1-6]|p|li|tr|section|div)>|<br\s*/?>', '\n', html)
    return unescape(re.sub(r'<[^>]+>', ' ', html)).strip()


def passages(text, *_):
    # Short windows keep the cited answer separate from unrelated nearby topics.
    result, pending = [], ''
    for block in text.splitlines():
        block = ' '.join(block.split())
        if not block:
            continue
        for sentence in re.split(r'(?<=[.!?…])\s+', block):
            for part in textwrap.wrap(sentence, 420, break_long_words=False, break_on_hyphens=False):
                if pending and len(pending) + len(part) > 420:
                    result.append(pending)
                    pending = ''
                pending = (pending + ' ' + part).strip()
        if len(pending) >= 100:
            result.append(pending)
            pending = ''
    if pending:
        result.append(pending)
    return result


_STOP = set('có của là và hay khi như thế nào để cho các một những được thì gì tại ở nếu không tôi cần với có phải nên'.split())
_INTENT = set('giá chi phí bao nhiêu khi nào cách làm sao tốt nhất so sánh đánh giá review'.split())


def normalized(text):
    text = unicodedata.normalize('NFD', text.casefold().replace('đ', 'd'))
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    for source, target in [('battery', 'pin'), ('warranty', 'bao hanh'), ('backup', 'sao luu'), ('cost', 'chi phi')]:
        text = re.sub(r'\b' + source + r'\b', target, text)
    return text


# Intent checks are shared across subjects and activate only when the query asks for them.
# Do not add a sample keyword as an intent; subject relevance is checked from the actual input.
_FACETS = {
    name: (re.compile(normalized(cue)), re.compile(normalized(answer)))
    for name, cue, answer in (
        ('price', r'(?<!đánh )\b(giá|chi phí|bao nhiêu tiền)\b', r'\b(giá|chi phí|phí|tiền|đồng|vnd|vnđ)\b|\d\s*₫'),
        ('data', r'\bdữ liệu\b', r'\b(dữ liệu|sao lưu|backup|data)\b'),
        ('warranty', r'\bbảo hành\b', r'\b(bảo hành|warranty)\b'),
        ('duration', r'\b(bao lâu|mất mấy phút)\b', r'\b(thời gian|phút|giờ|ngày|tháng|năm|bao lâu)\b'),
    )
}


def facet_rules(query):
    query = normalized(query)
    return [answer for cue, answer in _FACETS.values() if cue.search(query)]


def compatible(query, text):
    # Keep the model number with its product; a different device is not query evidence.
    q, t = normalized(query), normalized(text)
    brands = set('iphone ipad macbook samsung redmi oppo android'.split())
    expected, actual = set(q.split()) & brands, set(t.split()) & brands
    if expected and actual and not expected & actual:
        return False
    for model in models(q):
        competing = [m for m in models(t) if m.split()[0] == model.split()[0]]
        if competing and model not in competing:
            return False
    return True


def models(text):
    return set(re.findall(r'\b(?:iphone|ipad|macbook|samsung|redmi|oppo)\s+\d+\w*(?:\s+(?:pro|max|plus|ultra|mini))*', normalized(text)))


def substantive(query, text):
    q, t = normalized(query), normalized(text)
    if len(text) < 20:
        return False
    if _FACETS['price'][0].search(q) and not re.search(r'\d[\d.,]*\s*(?:dong|vnd|d\b|₫|trieu|nghin)|[$€£]\s*\d|mien phi', t):
        return False
    if _FACETS['duration'][0].search(q) and not re.search(r'\d+(?:[.,]\d+)?\s*(?:phut|gio|ngay|tuan|thang|nam)\b|trong ngay|ngay lap tuc', t):
        return False
    return True


def cluster_doors(queries, vectors, threshold, cosine):
    signatures = [frozenset(name for name, (cue, _) in _FACETS.items() if cue.search(normalized(q))) for q in queries]
    groups, assigned = [], set()
    for i, query in enumerate(queries):
        if i in assigned:
            continue
        members = [i]
        for j in range(i+1, len(queries)):
            if j not in assigned and signatures[i] == signatures[j] and models(query) == models(queries[j]) and cosine(vectors[i], vectors[j]) >= threshold:
                members.append(j)
                assigned.add(j)
        groups.append(dict(representative=query, members=[queries[k] for k in members], member_indices=members))
    return groups


def terms(text):
    return set(re.findall(r'\w+', normalized(text))) - set(normalized(' '.join(_STOP)).split())


def passage_index(texts):
    words = [terms(text) for text in texts]
    frequency = Counter(term for row in words for term in row)
    weights = {term: 1 + log((len(words) + 1) / (count + 1)) for term, count in frequency.items()}
    return words, weights


def select_passages(texts, queries, limit=None, keyword=''):
    """Cover each query with local evidence before spending embedding quota."""
    words, weights = passage_index(texts)
    selected = set()
    ranked_by_query = []
    for query in queries:
        query_words = terms(query)
        required = facet_rules(query)
        ranked = []
        for i, tokens in enumerate(words):
            if not compatible(keyword + ' ' + query, texts[i]) or not substantive(query, texts[i]) or any(not re.search(pattern, normalized(texts[i])) for pattern in required):
                continue
            overlap = sum(weights[word] for word in query_words & tokens)
            if overlap and (query_words - set(normalized(' '.join(_INTENT)).split())) & tokens:
                ranked.append((overlap, i))
        ranked.sort(key=lambda row: (-row[0], row[1]))
        # Keep a fallback when local evidence cannot clearly distinguish the top two.
        complex_query = bool(re.search(r'\b(so sanh|khac nhau|tung|uu nhuoc|va|hay)\b', normalized(query)))
        candidates = [ranked[0][1]] if ranked else []
        if len(ranked) > 1 and (complex_query or ranked[1][0] >= .85 * ranked[0][0]):
            candidates.append(ranked[1][1])
        ranked_by_query.append(candidates)
    for rank in range(2):
        for candidates in ranked_by_query:
            if limit is not None and len(selected) >= limit:
                break
            if len(candidates) > rank:
                selected.add(candidates[rank])
    return [texts[i] for i in sorted(selected)]


def match(query, texts, vector, vectors, cosine, words, weights, keyword=''):
    query_words = terms(query)
    weight = sum(weights.get(w, 1) for w in query_words) or 1
    required = facet_rules(query)
    best = None
    for i, (text, v, tokens) in enumerate(zip(texts, vectors, words, strict=True)):
        if not compatible(keyword + ' ' + query, text) or not substantive(query, text) or any(not re.search(pattern, normalized(text)) for pattern in required):
            continue
        score = cosine(vector, v)
        overlap = sum(weights[w] for w in query_words & tokens) / weight
        if not overlap or not (query_words - set(normalized(' '.join(_INTENT)).split())) & tokens or (overlap < .2 and score < .18):
            continue
        priority = score + .18 * overlap
        if best is None or priority > best[0]:
            best = (priority, score, i)
    return None if best is None else best[1:]
