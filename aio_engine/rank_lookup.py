"""Live organic rank lookup for an audited door; no result is persisted."""
import re
from urllib.parse import urlsplit

import requests


def domain_name(value):
    value = str(value or '').strip().lower()
    parts = urlsplit(value if '://' in value else 'https://' + value)
    if not value or parts.path not in ('', '/') or parts.query or parts.fragment:
        raise ValueError('Nhập tên miền, không kèm đường dẫn.')
    if parts.scheme not in ('http', 'https') or parts.port or parts.username or parts.password:
        raise ValueError('Nhập tên miền hợp lệ.')
    host = parts.hostname or ''
    host = host.removeprefix('www.').rstrip('.')
    if (len(host) > 253 or len(host.split('.')) < 2 or
            any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', part)
                for part in host.split('.'))):
        raise ValueError('Tên miền không hợp lệ.')
    return host


def organic_items(payload, provider):
    if provider == 'serper':
        items = payload.get('organic') or []
        return [(item['link'], item.get('position')) for item in items
                if isinstance(item, dict) and item.get('link')]
    if provider == 'serpapi':
        items = payload.get('organic_results') or []
        return [(item['link'], item.get('position')) for item in items
                if isinstance(item, dict) and item.get('link')]
    tasks = payload.get('tasks') or []
    if tasks and tasks[0].get('status_code') not in (None, 20000):
        raise ValueError('DataForSEO báo lỗi. Kiểm tra API key và quota.')
    results = tasks[0].get('result') if tasks else None
    if not results:
        return []
    return [(item['url'], item.get('rank_group')) for item in (results[0].get('items') or [])
            if isinstance(item, dict) and item.get('type') == 'organic' and item.get('url')]


def request_page(provider, key, query, config, depth, offset, session=requests):
    timeout = 20
    try:
        if provider == 'serper':
            response = session.post('https://google.serper.dev/search',
                headers={'X-API-KEY': key, 'Content-Type': 'application/json'},
                json={'q': query, 'gl': config['country'], 'hl': config['language'],
                      'num': depth if offset == 0 else 10, 'page': offset // 10 + 1}, timeout=timeout)
        elif provider == 'serpapi':
            response = session.get('https://serpapi.com/search', params={
                'engine': 'google', 'q': query, 'gl': config['country'],
                'hl': config['language'], 'location': config['location'],
                'api_key': key, 'num': depth if offset == 0 else 10,
                'start': offset}, timeout=timeout)
        elif provider == 'dataforseo':
            from base64 import b64encode
            if ':' not in key:
                raise ValueError('DataForSEO cần login:password.')
            response = session.post('https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
                headers={'Authorization': 'Basic ' + b64encode(key.encode()).decode(),
                         'Content-Type': 'application/json'},
                json=[{'keyword': query, 'location_name': config['location'],
                       'language_code': config['language'], 'depth': depth}], timeout=60)
        else:
            raise ValueError('Chọn nhà cung cấp SERP để tra thứ hạng.')
        if response.status_code != 200:
            raise ValueError(f'Nhà cung cấp SERP trả về HTTP {response.status_code}. Kiểm tra API key và quota.')
        payload = response.json()
    except requests.RequestException as exc:
        raise ValueError('Chưa kết nối được nhà cung cấp SERP. Thử lại sau.') from exc
    except (TypeError, ValueError) as exc:
        if isinstance(exc, ValueError) and ('SERP' in str(exc) or 'DataForSEO' in str(exc)):
            raise
        raise ValueError('Nhà cung cấp SERP trả về dữ liệu không hợp lệ.') from exc
    if not isinstance(payload, dict) or payload.get('error'):
        raise ValueError('Nhà cung cấp SERP báo lỗi. Kiểm tra API key và quota.')
    return organic_items(payload, provider)


def lookup(result, credentials, domain, query, depth=30, session=requests):
    config = result['config']
    provider = config['provider']
    key = str((credentials or {}).get('serp') or '').strip()
    if provider == 'none' or not key:
        raise ValueError('Nhập API key SERP trong phần thiết lập AIO để tra thứ hạng.')
    if not isinstance(query, str) or query not in {d['representative'] for d in result['doors']}:
        raise ValueError('Door không thuộc audit này.')
    if depth not in (10, 30, 100):
        raise ValueError('Chọn phạm vi Top 10, 30 hoặc 100.')
    domain = domain_name(domain)
    seen = set()
    checked = 0
    offset = 0
    requests_made = 0
    while checked < depth and requests_made <= depth // 10:
        items = request_page(provider, key, query, config, depth, offset, session)
        requests_made += 1
        fresh = 0
        for link, position in items:
            if not isinstance(link, str) or link in seen:
                continue
            parsed = urlsplit(link)
            if parsed.scheme not in ('http', 'https') or not parsed.hostname:
                continue
            seen.add(link)
            fresh += 1
            checked += 1
            rank = position if isinstance(position, int) and not isinstance(position, bool) and position > 0 else checked
            if offset and rank <= offset:
                rank += offset
            host = parsed.hostname.lower().removeprefix('www.').rstrip('.')
            if rank <= depth and (host == domain or host.endswith('.' + domain)):
                return {'door': query, 'domain': domain, 'rank': rank,
                        'ranking_url': link, 'checked': checked, 'depth': depth}
            if checked >= depth:
                break
        if checked >= depth or fresh == 0 or len(items) < 10 or provider == 'dataforseo':
            break
        offset = max(offset + 10, checked // 10 * 10)
    return {'door': query, 'domain': domain, 'rank': None,
            'ranking_url': '', 'checked': checked, 'depth': depth}
