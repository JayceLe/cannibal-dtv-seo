import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { fetchGscSnapshot, gscKeywordBatches, gscPeriod, GSC_SCOPE, keywordPattern, makeGscReader, normalizeGscRows, parseGscCredentials, verifyGscDates, type GscRead, type GscRow } from '../src/lib/gsc-source';
import { parseImportRows } from '../src/lib/import-parser';

test('Monday labels use Friday through the Friday four weeks before, including both boundaries', () => {
  const expected = { reportDate: '2026-11-16', startDate: '2026-10-16', endDate: '2026-11-13', days: 29 };
  assert.deepEqual(gscPeriod(new Date('2026-11-16T03:00:00Z')), expected);
  assert.deepEqual(gscPeriod(new Date('2026-11-17T07:00:00Z')), expected);
  assert.deepEqual(gscPeriod(new Date('2026-11-22T17:00:00Z')), { reportDate: '2026-11-23', startDate: '2026-10-23', endDate: '2026-11-20', days: 29 });
  assert.equal(gscPeriod(new Date('2026-01-05T03:00:00Z')).startDate, '2025-12-05');
});

const period = gscPeriod(new Date('2026-11-16T03:00:00Z'));
const dates = Array.from({ length: 29 }, (_, index) => ({ keys: [new Date(Date.parse(`${period.startDate}T12:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10)], impressions: 100, clicks: 1, position: 1 }));

test('an unavailable or incomplete Friday cannot silently shorten the period', async () => {
  await verifyGscDates(async () => ({ rows: dates }), period);
  await assert.rejects(verifyGscDates(async () => ({ rows: dates.slice(0, -1) }), period), /2026-11-13/);
  await assert.rejects(verifyGscDates(async () => ({ rows: dates, metadata: { first_incomplete_date: '2026-11-13' } }), period), /chưa chốt/);
});

test('GSC normalization reproduces the existing mapped CSV metrics with the whole-period clicks filter', () => {
  const rows: GscRow[] = [
    { keys: ['Hoa lan', 'https://example.com/a'], impressions: 50, clicks: 1, position: 2.34 },
    { keys: ['hoa lan', 'https://example.com/b'], impressions: 20, clicks: 2, position: 3.15 },
    { keys: ['hoa lan', 'https://example.com/c'], impressions: 200, clicks: 0, position: 1.1 },
    { keys: ['hoa lan', 'https://example.com/a#faq'], impressions: 8, clicks: 1, position: 1.6 },
  ];
  const normalized = normalizeGscRows(rows, ['hoa lan']);
  const csv = parseImportRows([['Query', 'URL', 'Impression', 'Position'], ...rows.filter(row => row.clicks >= 1).map(row => [...row.keys, row.impressions, row.position])], 'weekly', 'en-US', ['hoa lan']);
  assert.deepEqual(normalized.data, csv.data);
  assert.equal(normalized.quality.anchors, 1);
  assert.equal(normalized.quality.withoutClicks, 1);
  assert.equal(normalized.quality.sourceImpressions, 70);
  assert.throws(() => normalizeGscRows([...rows, rows[0]], ['hoa lan']), /lặp/);
  assert.throws(() => normalizeGscRows([{ ...rows[0], keys: ['khác', rows[0].keys[1]] }], ['hoa lan']), /ngoài/);
  assert.throws(() => normalizeGscRows([{ ...rows[0], position: NaN }], ['hoa lan']), /không hợp lệ/);
});

test('query partitions escape regex, preserve accents and stay bounded for the complete base list', () => {
  const keys = Array.from({ length: 35_000 }, (_, index) => `thiết bị ${index} (bản+)`);
  const groups = gscKeywordBatches(keys);
  assert.equal(groups.flat().length, keys.length);
  assert.ok(groups.every(group => group.length <= 150 && keywordPattern(group).length <= 3000));
  const expression = new RegExp(keywordPattern(['hoa (lan)+']).replace('(?i)', ''), 'i');
  assert.ok(expression.test(' HOA (LAN)+ '));
  assert.ok(!expression.test('hoa lan'));
  assert.ok(!expression.test('hoa (lan)+ giả'));
});

test('snapshot pagination checks the final page and refuses partial/empty source data', async () => {
  const starts: number[] = [];
  const read: GscRead = async body => {
    if ((body.dimensions as string[])[0] === 'date') return { rows: dates };
    starts.push(Number(body.startRow));
    return { rows: body.startRow === 0 ? [{ keys: ['hoa lan', 'https://example.com/a'], impressions: 10, clicks: 1, position: 2 }] : [] };
  };
  const result = await fetchGscSnapshot(read, period, ['hoa lan']);
  assert.deepEqual(starts, [0, 25_000]);
  assert.equal(result.data.length, 1);
  assert.equal(result.quality.reportDate, '2026-11-16');
  await assert.rejects(fetchGscSnapshot(async body => (body.dimensions as string[])[0] === 'date' ? { rows: dates } : { rows: [] }, period, ['hoa lan']), /dữ liệu trống/);
});

test('capped pages are discarded and retried using disjoint query sets', async () => {
  const capped = Array.from({ length: 25_000 }, () => ({ keys: ['ignored', 'https://example.com/a'], impressions: 1, clicks: 1, position: 1 }));
  const expressions: string[] = [];
  const read: GscRead = async body => {
    if ((body.dimensions as string[])[0] === 'date') return { rows: dates };
    const expression = (body.dimensionFilterGroups as { filters: { expression: string }[] }[])[0].filters[0].expression;
    expressions.push(expression);
    if (expression.includes('alpha|beta')) return { rows: capped };
    const word = expression.includes('alpha') ? 'alpha' : 'beta';
    return { rows: body.startRow === 0 ? [{ keys: [word, `https://example.com/${word}`], impressions: 4, clicks: 1, position: 3 }] : [] };
  };
  const result = await fetchGscSnapshot(read, period, ['alpha', 'beta']);
  assert.equal(result.data.length, 2);
  assert.ok(expressions.some(expression => expression === keywordPattern(['alpha'])));
  assert.ok(expressions.some(expression => expression === keywordPattern(['beta'])));
});

test('service credentials request only read-only GSC scope and fixed Google endpoints', async () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = parseGscCredentials({ type: 'service_account', client_email: 'reader@test-project.iam.gserviceaccount.com', private_key: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const called: { url: string; body: unknown }[] = [];
  const transport = (async (url, init) => {
    called.push({ url: String(url), body: init?.body });
    if (called.length === 1) return Response.json({ access_token: 'test-token' });
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-token');
    return Response.json({ rows: dates, responseAggregationType: 'byPage' });
  }) as typeof fetch;
  const read = await makeGscReader(credentials, transport);
  await verifyGscDates(read, period);
  const assertion = new URLSearchParams(String(called[0].body)).get('assertion')!;
  const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString());
  assert.equal(claims.scope, GSC_SCOPE);
  assert.equal(called[0].url, 'https://oauth2.googleapis.com/token');
  assert.ok(called[1].url.includes(encodeURIComponent('https://dienthoaivui.com.vn/')));
  const sent = JSON.parse(String(called[1].body));
  assert.equal(sent.dataState, 'final'); assert.equal(sent.type, 'web'); assert.equal(sent.aggregationType, 'byPage');
  assert.throws(() => parseGscCredentials({ type: 'authorized_user' }), /không phải/);
});
