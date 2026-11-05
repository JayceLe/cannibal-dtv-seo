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
_FACETS = (
    (r'(?<!đánh )\b(giá|chi phí|bao nhiêu tiền)\b', r'\b(giá|chi phí|phí|tiền|đồng|vnd|vnđ)\b|\d\s*₫'),
    (r'\b(thay pin|chai pin|tuổi thọ pin)\b', r'\b(pin|battery)\b'),
    (r'\bdữ liệu\b', r'\b(dữ liệu|sao lưu|backup|data)\b'),
    (r'\bbảo hành\b', r'\b(bảo hành|applecare|warranty)\b'),
    (r'\b(bao lâu|mất mấy phút)\b', r'\b(thời gian|phút|giờ|ngày|tháng|năm|bao lâu)\b'),
)


def terms(text):
    return set(re.findall(r'\w+', unicodedata.normalize('NFC', text).casefold())) - _STOP


def passage_index(texts):
    words = [terms(text) for text in texts]
    frequency = Counter(term for row in words for term in row)
    weights = {term: 1 + log((len(words) + 1) / (count + 1)) for term, count in frequency.items()}
    return words, weights


def select_passages(texts, queries, limit=24):
    """Cover each query with local evidence before spending embedding quota."""
    if len(texts) <= limit:
        return texts
    words, weights = passage_index(texts)
    selected = set(range(min(2, len(texts))))
    ranked_by_query = []
    for query in queries:
        query_words = terms(query)
        required = [answer for cue, answer in _FACETS if re.search(cue, query.casefold())]
        ranked = []
        for i, tokens in enumerate(words):
            if required and any(not re.search(pattern, texts[i].casefold()) for pattern in required):
                continue
            overlap = sum(weights[word] for word in query_words & tokens)
            if overlap and (query_words - _INTENT) & tokens:
                ranked.append((overlap, i))
        ranked_by_query.append([i for _, i in sorted(ranked, key=lambda row: (-row[0], row[1]))[:3]])
    for rank in range(3):
        for candidates in ranked_by_query:
            if len(selected) >= limit:
                break
            if len(candidates) > rank:
                selected.add(candidates[rank])
    # Two distributed fallbacks catch alternate wording without embedding the whole page.
    for i in (len(texts) // 3, 2 * len(texts) // 3):
        if len(selected) < limit:
            selected.add(i)
    return [texts[i] for i in sorted(selected)]


def match(query, texts, vector, vectors, cosine, words, weights):
    query_words = terms(query)
    weight = sum(weights.get(w, 1) for w in query_words) or 1
    required = [answer for cue, answer in _FACETS if re.search(cue, query.casefold())]
    best = None
    for i, (text, v, tokens) in enumerate(zip(texts, vectors, words, strict=True)):
        if any(not re.search(pattern, text.casefold()) for pattern in required):
            continue
        score = cosine(vector, v)
        overlap = sum(weights[w] for w in query_words & tokens) / weight
        if not overlap or not (query_words - _INTENT) & tokens or (overlap < .2 and score < .18):
            continue
        priority = score + .18 * overlap
        if best is None or priority > best[0]:
            best = (priority, score, i)
    return None if best is None else best[1:]
