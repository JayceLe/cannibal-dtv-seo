"""Authenticated AIO function. Gemini/SERP credentials never enter run checkpoints."""
import base64
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit
from aio_engine.storage import Store
from aio_engine import runtime

MAX_BODY = 3 * 1024 * 1024


def dispatch(store, payload):
    action = payload.get('action')
    credentials = payload.get('credentials', {})
    if not isinstance(credentials, dict) or any(not isinstance(value, str) or len(value) > 4096 for value in credentials.values()):
        raise ValueError('API key không hợp lệ.')
    if action == 'start':
        return runtime.start(store, payload.get('config', {}), credentials), None
    job = payload.get('id', '')
    if not isinstance(job, str) or not re.fullmatch(r'[a-f0-9]{32}', job):
        raise ValueError('Phiên audit không hợp lệ.')
    if action == 'step':
        return runtime.step(store, job, credentials), None
    state = store.read(job)
    if action == 'status':
        return state, None
    if state['stage'] != 'done':
        raise ValueError('Chạy audit thành công trước khi dùng phần kết quả và rank.')
    result = store.artifact(job, 'result')
    if action == 'result':
        return result, None
    if action == 'ranks':
        return runtime.rank_analysis(result, payload.get('rows')), None
    if action in ('template', 'export_ranks'):
        return runtime.rank_file(result, payload.get('rows') if action == 'export_ranks' else None), 'dtv_step9_ranks.xlsx'
    if action == 'import_ranks':
        if not str(payload.get('name', '')).lower().endswith('.xlsx'):
            raise ValueError('Chỉ hỗ trợ file .xlsx.')
        content = base64.b64decode(payload.get('file', ''), validate=True)
        if len(content) > 2 * 1024 * 1024:
            raise ValueError('File XLSX vượt 2 MB.')
        return runtime.import_ranks(result, content), None
    raise ValueError('Thao tác AIO không hợp lệ.')


class handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, status, data, filename=None):
        self.send_response(status)
        self.send_header('Cache-Control', 'private, no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if filename else 'application/json; charset=utf-8')
        if filename:
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.end_headers()
        self.wfile.write(data if filename else json.dumps(data, ensure_ascii=False, allow_nan=False).encode())

    def do_POST(self):
        payload = {}
        try:
            origin = self.headers.get('Origin')
            if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                raise PermissionError('Yêu cầu không đến từ website workspace.')
            authorization = self.headers.get('Authorization', '')
            if not authorization.startswith('Bearer ') or len(authorization) > 10000:
                raise PermissionError('Đăng nhập workspace trước khi sử dụng AIO.')
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > MAX_BODY:
                raise ValueError('Dữ liệu gửi lên quá lớn hoặc bị trống.')
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError('Dữ liệu yêu cầu phải là một object.')
            store = Store(authorization[7:])
            data, filename = dispatch(store, payload)
            self.send(200, data, filename)
        except Exception as exc:
            status = 401 if isinstance(exc, PermissionError) else 409 if isinstance(exc, BlockingIOError) else 404 if isinstance(exc, FileNotFoundError) else 400 if isinstance(exc, (ValueError, KeyError)) else 502
            message = str(exc)
            credentials = payload.get('credentials', {}) if isinstance(payload, dict) else {}
            if isinstance(credentials, dict):
                message = runtime.redact(message, credentials)
            if not message:
                message = 'Chưa hoàn tất thao tác. Thử lại hoặc tiếp tục phiên audit.'
            self.send(status, {'error': message[:2000], 'type': type(exc).__name__})
