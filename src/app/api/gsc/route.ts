import { timingSafeEqual } from 'node:crypto';
import { syncGsc } from '@/lib/gsc-sync';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (!process.env.CRON_SECRET || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  }
  try {
    return Response.json(await syncGsc(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Đồng bộ GSC thất bại.' }, {
      status: 502, headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
