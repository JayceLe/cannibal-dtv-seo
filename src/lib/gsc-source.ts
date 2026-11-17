import { createPrivateKey, sign } from 'node:crypto';
import { queryKey, type Metric } from './engine';

export const GSC_SITE = 'https://dienthoaivui.com.vn/';
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PAGE_SIZE = 25_000;
const SOURCE_CAP = 50_000;
export type GscPeriod = { reportDate: string; startDate: string; endDate: string; days: number };
export type GscCredentials = { type: 'service_account'; client_email: string; private_key: string };
export type GscRow = { keys: string[]; clicks: number; impressions: number; position: number };
type GscResponse = { rows?: GscRow[]; responseAggregationType?: string; metadata?: { first_incomplete_date?: string } };
export type GscRead = (body: Record<string, unknown>) => Promise<GscResponse>;

function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }
function shift(date: string, days: number) {
  return dateOnly(new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000));
}

export function gscPeriod(now = new Date()): GscPeriod {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const reportDate = shift(today, -((weekday + 6) % 7));
  const endDate = shift(reportDate, -3);
  // Both dates are inclusive, matching the source report's Friday-to-Friday range.
  return { reportDate, startDate: shift(endDate, -28), endDate, days: 29 };
}

export function parseGscCredentials(input: unknown): GscCredentials {
  if (!input || typeof input !== 'object') throw new Error('Chọn file JSON của tài khoản dịch vụ Google.');
  const value = input as Record<string, unknown>;
  if (value.type !== 'service_account' || typeof value.client_email !== 'string' ||
      !/^[a-z0-9._-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/i.test(value.client_email) ||
      typeof value.private_key !== 'string' || value.private_key.length > 16_384) {
    throw new Error('File không phải thông tin tài khoản dịch vụ Google hợp lệ.');
  }
  try {
    const key = createPrivateKey(value.private_key);
    if (key.asymmetricKeyType !== 'rsa') throw new Error();
  } catch { throw new Error('Khóa riêng trong file JSON không hợp lệ.'); }
  return { type: 'service_account', client_email: value.client_email, private_key: value.private_key };
}

export async function makeGscReader(credentials: GscCredentials, transport: typeof fetch = fetch): Promise<GscRead> {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: credentials.client_email, scope: GSC_SCOPE, aud: TOKEN_URL, iat: now - 30, exp: now + 3500,
  })}`;
  const assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key).toString('base64url')}`;
  const auth = await transport(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store', signal: AbortSignal.timeout(25_000),
  });
  const token = await auth.json().catch(() => ({}));
  if (!auth.ok || typeof token.access_token !== 'string') throw new Error('Google không xác thực được tài khoản dịch vụ. Kiểm tra khóa JSON còn hiệu lực.');
  const deadline = Date.now() + 235_000;
  return async (body) => {
    if (Date.now() > deadline) throw new Error('Lượt đọc GSC quá thời gian. Bản cũ được giữ nguyên; thử lại khi Google phản hồi nhanh hơn.');
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await transport(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, type: 'web', dataState: 'final', aggregationType: 'byPage' }),
        cache: 'no-store', signal: AbortSignal.timeout(35_000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
        continue;
      }
      if (!response.ok) {
        if (response.status === 403) throw new Error('GSC từ chối quyền đọc. Bật Search Console API trong Google Cloud và thêm email tài khoản dịch vụ vào property với quyền Hạn chế.');
        if (response.status === 429) throw new Error('GSC đang giới hạn lượt đọc. Dữ liệu chưa hoàn tất sẽ không được công bố.');
        throw new Error(`Không đọc được GSC (HTTP ${response.status}).`);
      }
      const result = await response.json() as GscResponse;
      if (result.responseAggregationType !== 'byPage') throw new Error('GSC trả sai kiểu tổng hợp URL. Dừng để tránh tính sai impression và vị trí.');
      return result;
    }
    throw new Error('GSC tạm thời không phản hồi.');
  };
}

export async function verifyGscDates(read: GscRead, period: GscPeriod) {
  const response = await read({ startDate: period.startDate, endDate: period.endDate, dimensions: ['date'], rowLimit: 100 });
  if (response.metadata?.first_incomplete_date && response.metadata.first_incomplete_date <= period.endDate) {
    throw new Error(`GSC chưa chốt dữ liệu đến ${period.endDate}; giữ nguyên kỳ cũ và thử lại sau.`);
  }
  const dates = new Set((response.rows ?? []).map(row => row.keys[0]));
  for (let date = period.startDate; date <= period.endDate; date = shift(date, 1)) {
    if (!dates.has(date)) throw new Error(`GSC chưa có dữ liệu hoàn tất ngày ${date}. Không rút ngắn hoặc dịch chuyển kỳ báo cáo.`);
  }
}

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'); }
export function keywordPattern(keys: string[]) {
  const forms = new Set(keys.flatMap(key => [key.normalize('NFC'), key.normalize('NFD')]));
  return `(?i)^\\s*(?:${[...forms].map(escapeRegex).join('|')})\\s*$`;
}
export function gscKeywordBatches(keys: string[]): string[][] {
  const unique = [...new Set(keys.map(queryKey).filter(Boolean))].sort();
  const batches: string[][] = [];
  let current: string[] = [];
  for (const key of unique) {
    if (current.length && (current.length >= 150 || keywordPattern([...current, key]).length > 3000)) {
      batches.push(current); current = [];
    }
    if (keywordPattern([key]).length > 3000) throw new Error('Có từ khóa gốc quá dài để đọc chính xác qua GSC.');
    current.push(key);
  }
  if (current.length) batches.push(current);
  return batches;
}

export function normalizeGscRows(rows: GscRow[], baseKeys: string[]) {
  const known = new Set(baseKeys.map(queryKey)), seen = new Set<string>();
  const metrics = new Map<string, Metric>();
  let anchors = 0, withoutClicks = 0, impressions = 0;
  for (const row of rows) {
    if (!Array.isArray(row.keys) || row.keys.length !== 2) throw new Error('GSC trả sai cột Query–URL.');
    const [query, url] = row.keys;
    if (typeof query !== 'string' || typeof url !== 'string') throw new Error('GSC trả Query hoặc URL không hợp lệ.');
    const key = queryKey(query), id = JSON.stringify([query, url]);
    if (!known.has(key)) throw new Error('GSC trả query nằm ngoài bộ từ khóa đã yêu cầu.');
    if (seen.has(id)) throw new Error('GSC trả lặp cặp Query–URL giữa các trang. Dừng để tránh cộng hai lần.');
    seen.add(id);
    if (!Number.isSafeInteger(row.impressions) || row.impressions < 1 || !Number.isSafeInteger(row.clicks) ||
        row.clicks < 0 || row.clicks > row.impressions || !Number.isFinite(row.position) || row.position < 1) {
      throw new Error('GSC trả impression, click hoặc vị trí không hợp lệ.');
    }
    const address = new URL(url);
    if (!['https:', 'http:'].includes(address.protocol) || !address.hostname) throw new Error('GSC trả URL không hợp lệ.');
    // The Looker metric filter is applied to each source Query–URL over the WHOLE period.
    // Do not filter zero-click days or discard low-impression secondary URLs afterwards.
    if (row.clicks < 1) { withoutClicks++; continue; }
    if (url.includes('#')) { anchors++; continue; }
    const metricId = JSON.stringify([key, url]);
    const metric = metrics.get(metricId) ?? { key, url, impressions: 0, clicks: 0, weighted_position: 0, position_weight: 0, missing_rank: 0, invalid_rows: 0 };
    metric.impressions += row.impressions;
    metric.weighted_position += row.position * row.impressions;
    metric.position_weight += row.impressions;
    // Clicks remain a source filter only, matching the existing cannibal importer.
    if (!Number.isSafeInteger(metric.impressions) || !Number.isFinite(metric.weighted_position)) throw new Error('Tổng dữ liệu GSC vượt giới hạn số an toàn.');
    metrics.set(metricId, metric);
    impressions += row.impressions;
  }
  return { data: [...metrics.values()].sort((a, b) => a.key.localeCompare(b.key) || a.url.localeCompare(b.url)), quality: {
    rows: rows.length, invalid: 0, anchors, withoutClicks, missingRank: 0, duplicates: 0, blank: 0,
    unmappedRows: 0, unmappedQueries: 0, mapped: true, samples: [], sourceImpressions: impressions,
    source: 'gsc-api', site: GSC_SITE, searchType: 'web', aggregationType: 'byPage', clickFilter: '>=1',
  } };
}

export async function fetchGscSnapshot(read: GscRead, period: GscPeriod, baseKeys: string[]) {
  await verifyGscDates(read, period);
  const rows: GscRow[] = [];
  let requests = 1;
  const collect = async (keys: string[]): Promise<void> => {
    const received: GscRow[] = [];
    for (let startRow = 0; startRow <= SOURCE_CAP; startRow += PAGE_SIZE) {
      const page = await read({
        startDate: period.startDate, endDate: period.endDate, dimensions: ['query', 'page'],
        dimensionFilterGroups: [{ groupType: 'and', filters: [{ dimension: 'query', operator: 'includingRegex', expression: keywordPattern(keys) }] }],
        rowLimit: PAGE_SIZE, startRow,
      });
      requests++;
      if (page.metadata?.first_incomplete_date && page.metadata.first_incomplete_date <= period.endDate) throw new Error('GSC thay đổi trạng thái chốt ngày trong khi đang tải.');
      const data = page.rows ?? [];
      if (!Array.isArray(data) || data.length > PAGE_SIZE) throw new Error('Trang dữ liệu GSC không hợp lệ.');
      received.push(...data);
      if (received.length >= SOURCE_CAP) {
        // Never publish a capped response as complete. Retry smaller, disjoint query sets.
        if (keys.length === 1) throw new Error('Một query chạm giới hạn trả dữ liệu GSC; chưa thể công bố kỳ này đầy đủ.');
        const middle = Math.ceil(keys.length / 2);
        await collect(keys.slice(0, middle)); await collect(keys.slice(middle));
        return;
      }
      if (!data.length) { rows.push(...received); return; }
    }
    throw new Error('Chưa đọc hết các trang dữ liệu GSC.');
  };
  const batches = gscKeywordBatches(baseKeys);
  if (!batches.length) throw new Error('Chưa có bộ từ khóa gốc để map dữ liệu.');
  let cursor = 0, stopped = false;
  const results = await Promise.allSettled(Array.from({ length: Math.min(4, batches.length) }, async () => {
    try {
      while (!stopped && cursor < batches.length) { const batch = batches[cursor++]; await collect(batch); }
    } catch (error) { stopped = true; throw error; }
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  const snapshot = normalizeGscRows(rows, baseKeys);
  if (!snapshot.data.length) throw new Error('GSC không trả cặp Query–URL hợp lệ có click trong bộ gốc. Không thay kỳ cũ bằng dữ liệu trống.');
  return { ...snapshot, quality: { ...snapshot.quality, ...period, baseKeywords: new Set(baseKeys).size, apiRequests: requests, sourcePartitions: batches.length } };
}
