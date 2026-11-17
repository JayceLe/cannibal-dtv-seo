import { createClient } from '@supabase/supabase-js';
import { fetchGscSnapshot, gscPeriod, makeGscReader, parseGscCredentials, type GscRead } from './gsc-source';

export async function gscDatabase<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!process.env.CRON_SECRET) throw new Error('Chưa cấu hình lịch đồng bộ trên máy chủ.');
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/seo_gsc_worker`, {
    method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: process.env.CRON_SECRET, p_action: action, p_payload: payload }),
    cache: 'no-store', signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (data.message === 'Workspace access denied') throw new Error('Tài khoản này không quản lý kết nối GSC của workspace.');
    if (data.message === 'GSC connection required') throw new Error('Chưa kết nối tài khoản dịch vụ GSC.');
    if (data.message === 'GSC sync already running') throw new Error('Một lượt đồng bộ GSC đang chạy. Chờ lượt đó hoàn tất.');
    throw new Error(`Không hoàn tất được bước ${action} của đồng bộ GSC (HTTP ${response.status}). Dữ liệu đã công bố được giữ nguyên.`);
  }
  return response.json();
}

export async function gscOwner(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Vui lòng đăng nhập workspace.');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(header.slice(7));
  if (error || !data.user) throw new Error('Phiên đăng nhập workspace đã hết hạn.');
  // This also checks the fixed workspace owner on the server; user metadata is never trusted.
  await gscDatabase('status', { owner: data.user.id });
  return data.user.id;
}

export async function syncGsc(reader?: GscRead) {
  const period = gscPeriod();
  let lease: string | undefined;
  try {
    const state = await gscDatabase<{ lease: string; baseVersion: string; keys: string[]; skipped?: boolean; result?: Record<string, unknown> }>('claim', period);
    if (state.skipped) return { ...state.result, skipped: true };
    lease = state.lease;
    if (!reader) {
      const config = await gscDatabase<{ credentials: unknown }>('config');
      reader = await makeGscReader(parseGscCredentials(config.credentials));
    }
    const snapshot = await fetchGscSnapshot(reader, period, state.keys);
    await gscDatabase('begin', { lease, baseVersion: state.baseVersion, rows: snapshot.data.length, quality: snapshot.quality });
    for (let start = 0; start < snapshot.data.length; start += 1000) {
      await gscDatabase('batch', { lease, batch: start / 1000, rows: snapshot.data.slice(start, start + 1000) });
    }
    const result = await gscDatabase('commit', { lease });
    // Publication has committed. A cleanup timeout must not turn a successful import into a failure receipt.
    await gscDatabase('release', { lease }).catch(() => {});
    return result;
  } catch (error) {
    if (lease) await gscDatabase('release', { lease, result: { ok: false, ...period, error: error instanceof Error ? error.message : 'Đồng bộ GSC thất bại.', checkedAt: new Date().toISOString() } }).catch(() => {});
    throw error;
  }
}
