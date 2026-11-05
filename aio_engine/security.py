"""HTTP fetching for untrusted page URLs. Resolve, validate and pin each redirect hop."""
import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlsplit, urljoin
import requests


def public_address(url):
    p = urlsplit(url)
    if p.scheme.lower() not in ('http', 'https') or not p.hostname or p.username or p.password:
        raise ValueError('URL phải đầy đủ, dùng http hoặc https và không chứa tài khoản.')
    host = p.hostname.rstrip('.').lower()
    if host == 'localhost' or host.endswith(('.localhost', '.local', '.internal')):
        raise ValueError('Chỉ đọc trang web công khai.')
    port = p.port or (443 if p.scheme == 'https' else 80)
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    ips = list(dict.fromkeys(info[4][0] for info in addresses))
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise ValueError('Chỉ đọc trang web công khai; URL này trỏ tới mạng nội bộ.')
    if host == 'r.jina.ai' and p.path.startswith(('/http://', '/https://')):
        public_address(p.path[1:])
    return p, ips[0], port


def public_get(url, headers=None, timeout=30, params=None, **_):
    url = requests.Request('GET', url, params=params).prepare().url
    for _hop in range(6):
        p, ip, port = public_address(url)
        connection = http.client.HTTPConnection(p.hostname, port, timeout=timeout)
        connection.sock = socket.create_connection((ip, port), timeout=timeout)
        try:
            if p.scheme == 'https':
                connection.sock = ssl.create_default_context().wrap_socket(connection.sock, server_hostname=p.hostname)
            connection.request('GET', (p.path or '/') + ('?' + p.query if p.query else ''), headers=headers or {})
            incoming = connection.getresponse()
            if incoming.status in (301, 302, 303, 307, 308) and incoming.getheader('Location'):
                url = urljoin(url, incoming.getheader('Location'))
                continue
            content = incoming.read(12 * 1024 * 1024 + 1)
            if len(content) > 12 * 1024 * 1024:
                raise ValueError('Nội dung trang vượt giới hạn 12 MB.')
            response = requests.Response()
            response.status_code = incoming.status
            response.url = url
            response.headers = requests.structures.CaseInsensitiveDict(incoming.getheaders())
            response._content = content
            response.encoding = requests.utils.get_encoding_from_headers(response.headers)
            return response
        finally:
            connection.close()
    raise ValueError('Trang chuyển hướng quá nhiều lần.')
