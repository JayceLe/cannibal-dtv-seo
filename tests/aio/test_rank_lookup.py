"""Rank lookup tests use fake SERP replies; they make no paid requests."""
import unittest

from aio_engine import rank_lookup


RESULT = {
    'config': {'provider': 'serper', 'country': 'vn', 'language': 'vi', 'location': 'Vietnam'},
    'doors': [{'representative': 'thay pin iPhone bao lâu'}],
}


class Response:
    status_code = 200

    def __init__(self, links):
        self.links = links

    def json(self):
        return {'organic': [item if isinstance(item, dict) else {'link': item}
                            for item in self.links]}


class Session:
    def __init__(self, pages):
        self.pages = iter(pages)
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return Response(next(self.pages))


class RankLookup(unittest.TestCase):
    def test_finds_exact_or_subdomain_and_uses_real_organic_order(self):
        links = [f'https://competitor{i}.vn/page' for i in range(10)]
        session = Session([links, ['https://shop.example.com/pin']])
        found = rank_lookup.lookup(RESULT, {'serp': 'key'}, 'example.com',
                                   'thay pin iPhone bao lâu', 30, session)
        self.assertEqual((found['rank'], found['ranking_url'], found['checked']),
                         (11, 'https://shop.example.com/pin', 11))
        self.assertEqual(session.calls[0][1]['json']['num'], 30)
        self.assertEqual(session.calls[1][1]['json']['page'], 2)

    def test_partial_results_never_claim_outside_top(self):
        session = Session([['https://notexample.com/page']])
        found = rank_lookup.lookup(RESULT, {'serp': 'key'}, 'example.com',
                                   'thay pin iPhone bao lâu', 100, session)
        self.assertIsNone(found['rank'])
        self.assertEqual(found['checked'], 1)
        self.assertEqual(len(session.calls), 1)

    def test_provider_position_takes_precedence_over_array_index(self):
        session = Session([[{'link': 'https://example.com/pin', 'position': 4}]])
        found = rank_lookup.lookup(RESULT, {'serp': 'key'}, 'example.com',
                                   'thay pin iPhone bao lâu', 10, session)
        self.assertEqual(found['rank'], 4)

    def test_pages_after_a_partial_first_batch_without_rechecking_page_two(self):
        first = [f'https://competitor{i}.vn/page' for i in range(20)]
        session = Session([first, ['https://example.com/pin']])
        found = rank_lookup.lookup(RESULT, {'serp': 'key'}, 'example.com',
                                   'thay pin iPhone bao lâu', 30, session)
        self.assertEqual(found['rank'], 21)
        self.assertEqual(session.calls[1][1]['json']['page'], 3)

    def test_rejects_unrelated_door_and_invalid_domain_before_api_call(self):
        session = Session([])
        with self.assertRaisesRegex(ValueError, 'Door'):
            rank_lookup.lookup(RESULT, {'serp': 'key'}, 'example.com', 'khác', 30, session)
        with self.assertRaisesRegex(ValueError, 'đường dẫn'):
            rank_lookup.lookup(RESULT, {'serp': 'key'}, 'example.com/pin',
                               'thay pin iPhone bao lâu', 30, session)
        self.assertFalse(session.calls)


if __name__ == '__main__':
    unittest.main()
