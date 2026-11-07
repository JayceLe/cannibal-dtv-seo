"""Exercise the real orchestration/extraction/scoring with only provider I/O replaced."""
import copy
import hashlib
import json
import unittest
from collections import Counter
from types import SimpleNamespace
from unittest.mock import Mock, patch

from aio_engine import evidence, runtime
from test_aio import MemoryStore


CASES = {
    'thay pin iPhone': [
        ('Giá thay pin iPhone?', 'Giá thay pin iPhone là 800.000 đồng.'),
        ('Thay pin iPhone mất bao lâu?', 'Thay pin iPhone mất 45 phút.'),
        ('Bảo hành thay pin iPhone?', 'Bảo hành thay pin iPhone trong 12 tháng.'),
        ('Dấu hiệu cần thay pin iPhone?', 'Cần thay pin iPhone khi pin phồng hoặc sụt nguồn liên tục.'),
        ('Thay pin iPhone có mất dữ liệu?', 'Thay pin iPhone không xóa dữ liệu, nên sao lưu trước khi sửa.'),
    ],
    'phần mềm quản lý nhân sự': [
        ('Phần mềm quản lý nhân sự là gì?', 'Phần mềm quản lý nhân sự tập trung hồ sơ, chấm công và nghỉ phép.'),
        ('Chi phí phần mềm quản lý nhân sự?', 'Chi phí phần mềm quản lý nhân sự là 200.000 đồng mỗi tháng.'),
        ('Triển khai phần mềm quản lý nhân sự mất bao lâu?', 'Triển khai phần mềm quản lý nhân sự mất 10 ngày.'),
        ('Bảo vệ dữ liệu phần mềm quản lý nhân sự?', 'Dữ liệu phần mềm quản lý nhân sự được mã hóa và phân quyền truy cập.'),
        ('Phần mềm quản lý nhân sự tích hợp chấm công?', 'Phần mềm quản lý nhân sự đồng bộ máy chấm công qua API nội bộ.'),
    ],
    'du lịch Đà Lạt': [
        ('Du lịch Đà Lạt mùa nào?', 'Du lịch Đà Lạt mùa khô thuận tiện đi bộ và tham quan ngoài trời.'),
        ('Chi phí du lịch Đà Lạt?', 'Chi phí du lịch Đà Lạt khoảng 3.000.000 đồng cho mỗi người.'),
        ('Du lịch Đà Lạt đi bao lâu?', 'Du lịch Đà Lạt thường kéo dài 3 ngày.'),
        ('Du lịch Đà Lạt di chuyển bằng gì?', 'Du lịch Đà Lạt có thể di chuyển bằng xe khách hoặc máy bay.'),
        ('Du lịch Đà Lạt khi trời mưa?', 'Du lịch Đà Lạt khi trời mưa nên chuẩn bị áo mưa và đổi lịch tham quan.'),
    ],
    'chăm sóc cây lan': [
        ('Chăm sóc cây lan tưới nước thế nào?', 'Chăm sóc cây lan cần tưới khi giá thể khô và tránh đọng nước.'),
        ('Chăm sóc cây lan cần ánh sáng gì?', 'Chăm sóc cây lan cần ánh sáng tán xạ và tránh nắng trực tiếp.'),
        ('Chăm sóc cây lan bị vàng lá?', 'Chăm sóc cây lan bị vàng lá cần kiểm tra rễ và độ ẩm giá thể.'),
        ('Chăm sóc cây lan sau khi ra hoa?', 'Chăm sóc cây lan sau khi ra hoa cần tỉa cành khô và giảm phân bón.'),
        ('Chăm sóc cây lan trong nhà?', 'Chăm sóc cây lan trong nhà cần thông gió và chậu thoát nước.'),
    ],
}


class AuditIsolation(unittest.TestCase):
    def test_interleaved_topics_and_repeated_keyword_use_only_current_provider_data(self):
        factory = runtime.engine
        store = MemoryStore()
        credentials = {'gemini': 'offline-gemini', 'serp': 'offline-serp'}
        generation = Counter()
        fetched = Counter()
        searched = Counter()
        embedded = []
        targets = ['https://workspace.example/article', 'https://rival-one.example/article',
                   'https://rival-two.example/article']

        def fake_engine(config, _credentials):
            ns = factory(config)
            topic = config['keyword']
            queries = [q for q, _ in CASES[topic]]

            def generate(**kwargs):
                prompt = kwargs['contents'][0]
                self.assertEqual(kwargs['model'], config['llm_model'])
                if prompt.startswith('Kiểm tra bằng chứng'):
                    return SimpleNamespace(text='[]')
                self.assertIn(f'The user searched: "{topic}"', prompt)
                for other in CASES:
                    if other != topic:
                        self.assertNotIn(other, prompt)
                generation[topic] += 1
                return SimpleNamespace(text=json.dumps(queries, ensure_ascii=False))

            def embed(**kwargs):
                self.assertEqual(kwargs['model'], config['embed_model'])
                embedded.extend(kwargs['contents'])
                # Synthetic vectors keep this regression deterministic without external quota.
                values = [list(hashlib.sha256(text.encode()).digest()[:16]) for text in kwargs['contents']]
                return SimpleNamespace(embeddings=[SimpleNamespace(values=v) for v in values])

            def get(url, **_):
                self.assertIn(url, targets)
                fetched[topic, url] += 1
                body = '<nav>Menu dùng chung</nav><main>' + ''.join(
                    f'<section><h2>{query}</h2><p>{answer} Bản đọc {generation[topic]}.</p></section>'
                    for query, answer in CASES[topic]) + '</main>'
                return SimpleNamespace(status_code=200, encoding='utf-8', text=body)

            def post(url, **kwargs):
                self.assertEqual(kwargs['json']['q'], topic)
                searched[topic] += 1
                return SimpleNamespace(status_code=200, json=lambda: {
                    'organic': [{'link': url} for url in targets[1:]]})

            ns['client'] = SimpleNamespace(close=Mock(), models=SimpleNamespace(
                generate_content=generate, embed_content=embed))
            ns['requests'] = SimpleNamespace(get=get, post=post)
            return ns

        states = [runtime.start(store, {'keyword': topic, 'my_url': targets[0]}, credentials)
                  for topic in CASES]
        original_results = {}
        with patch.object(runtime, 'engine', side_effect=fake_engine):
            # Advance different topics alternately through the same worker/store.
            for _ in range(8):
                for i, state in enumerate(states):
                    if state['stage'] != 'done':
                        states[i] = runtime.step(store, state['id'], credentials)
            for state in states:
                self.assertEqual(state['stage'], 'done')
                result = store.artifact(state['id'], 'result')
                topic = state['config']['keyword']
                actual_queries = {q for d in result['doors'] for q in d['members']}
                self.assertEqual(actual_queries, {q for q, _ in CASES[topic]})
                self.assertTrue(any(p['passage'] for p in result['passages'].values()))
                self.assertEqual(result['read_competitors'], 2)
                serialized = json.dumps(result, ensure_ascii=False)
                for other in CASES:
                    if other != topic:
                        self.assertNotIn(other, serialized)
                self.assertNotIn('Menu dùng chung', serialized)
                original_results[state['id']] = copy.deepcopy(result)

            # Same keyword + same URLs must still call providers and read the new source version.
            first = states[0]
            again = runtime.start(store, first['config'], credentials)
            for _ in range(8):
                if again['stage'] == 'done':
                    break
                again = runtime.step(store, again['id'], credentials)
            self.assertEqual(again['stage'], 'done')
            self.assertNotEqual(first['id'], again['id'])
            current = store.artifact(again['id'], 'result')
            self.assertIn('Bản đọc 2', json.dumps(current, ensure_ascii=False))
            self.assertNotIn('Bản đọc 1', json.dumps(current, ensure_ascii=False))

        self.assertEqual(generation, Counter({topic: 2 if i == 0 else 1 for i, topic in enumerate(CASES)}))
        self.assertEqual(searched, generation)
        for topic in CASES:
            for url in targets:
                self.assertEqual(fetched[topic, url], generation[topic])
        self.assertTrue(embedded)
        self.assertEqual(store.cached, {})
        for job, result in original_results.items():
            self.assertEqual(store.artifact(job, 'result'), result)

    def test_generic_intents_work_outside_phone_repair_and_do_not_pick_its_example(self):
        unrelated = 'Giá thay pin iPhone là 800.000 đồng, bảo hành 12 tháng và thay trong 45 phút.'
        for topic, cases in CASES.items():
            for query, answer in cases:
                with self.subTest(query=query):
                    selected = evidence.select_passages([unrelated, answer], [query], keyword=topic)
                    self.assertIn(answer, selected)
                    if topic != 'thay pin iPhone':
                        self.assertNotIn(unrelated, selected)

    def test_request_namespaces_do_not_retain_citations_keys_or_vectors(self):
        first = runtime.engine(runtime.validate_config({
            'keyword': 'thay pin iPhone', 'my_url': 'https://one.example',
            'manual_aio': 'https://first-rival.example/article'}))
        first['_EMB_CACHE']['prior text'] = [1, 2]
        first['LAST_DOORS'] = [{'representative': 'prior text'}]
        first['SERP_API_KEY'] = 'previous-key'
        second = runtime.engine(runtime.validate_config({
            'keyword': 'du lịch Đà Lạt', 'my_url': 'https://two.example'}))
        self.assertEqual(second['MANUAL_AIO_CITATIONS'], [])
        self.assertEqual(second['SERP_API_KEY'], '')
        self.assertEqual(second['_EMB_CACHE'], {})
        self.assertNotIn('LAST_DOORS', second)
