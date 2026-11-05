"""Private run checkpoints, always accessed with the current user's JWT and RLS."""
import gzip
import json
import os
from datetime import datetime, timezone
import requests


class Store:
    def __init__(self, token):
        self.base = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
        self.headers = {'apikey': os.environ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'], 'Authorization': 'Bearer ' + token}
        user = self.request('GET', '/auth/v1/user').json()
        self.owner = user['id']

    def request(self, method, path, **kwargs):
        headers = {**self.headers, **kwargs.pop('headers', {})}
        response = requests.request(method, self.base + path, headers=headers, timeout=90, **kwargs)
        try:
            detail = response.json() if response.status_code >= 400 else {}
        except ValueError:
            detail = {}
        # Storage returns HTTP 400 for a missing object; it is a cache miss.
        missing_object = path.startswith('/storage/v1/object/') and method == 'GET' and (
            str(detail.get('statusCode')) == '404' or detail.get('error') in ('not_found', 'NoSuchKey')
            or detail.get('message') == 'Object not found'
        )
        if response.status_code == 404 or missing_object:
            raise FileNotFoundError('Không tìm thấy phiên AIO hoặc kho lưu kết quả.')
        if response.status_code >= 400:
            if response.status_code in (401, 403):
                raise PermissionError('Phiên workspace đã hết hạn. Đăng nhập lại để tiếp tục.')
            code = detail.get('code') or detail.get('error') or str(response.status_code)
            raise RuntimeError(f'Chưa lưu được tiến độ AIO ({code}). Thử Tiếp tục audit; nếu còn lỗi, liên hệ quản trị workspace.')
        return response

    def create(self, job, state):
        self.request('POST', '/rest/v1/seo_aio_runs', json={'id': job, 'owner_id': self.owner, 'state': state})

    def read(self, job):
        data = self.request('GET', '/rest/v1/seo_aio_runs', params={'id': 'eq.' + job, 'select': 'state'}).json()
        if not data:
            raise FileNotFoundError('Không tìm thấy phiên audit trong workspace này.')
        return data[0]['state']

    def claim(self, job):
        data = self.request('POST', '/rest/v1/rpc/seo_aio_claim', json={'p_id': job}).json()
        if not data:
            raise BlockingIOError('Phiên audit đang xử lý một bước. Chờ bước đó xong rồi tiếp tục.')
        return data[0]['state']

    def save(self, job, state):
        now = datetime.now(timezone.utc).isoformat()
        self.request('PATCH', '/rest/v1/seo_aio_runs', params={'id': 'eq.' + job}, json={'state': state, 'lease_until': now, 'updated_at': now})

    def artifact(self, job, name, value=None):
        path = '/storage/v1/object/seo-aio/' + self.owner + '/' + job + '/' + name + '.json.gz'
        if value is None:
            data = self.request('GET', path).content
            return json.loads(gzip.decompress(data))
        data = gzip.compress(json.dumps(value, ensure_ascii=False, allow_nan=False).encode())
        self.request('POST', path, headers={'Content-Type': 'application/gzip', 'x-upsert': 'true'}, data=data)
