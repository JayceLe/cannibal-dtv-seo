import { gscDatabase, gscOwner, syncGsc } from '@/lib/gsc-sync';
import { gscPeriod, makeGscReader, parseGscCredentials, verifyGscDates } from '@/lib/gsc-source';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const owner = await gscOwner(request);
    return Response.json({ ...await gscDatabase('status', { owner }), period: gscPeriod() }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Không đọc được kết nối GSC.' }, { status: 403, headers });
  }
}
export async function POST(request: Request) {
  try {
    const owner = await gscOwner(request);
    const raw = await request.text();
    if (raw.length > 65_536) return Response.json({ error: 'File JSON vượt giới hạn 64 KB.' }, { status: 413, headers });
    const body = JSON.parse(raw);
    if (body.action === 'sync') return Response.json(await syncGsc(), { headers });
    const credentials = parseGscCredentials(body.credentials);
    const read = await makeGscReader(credentials);
    // Verify the actual property and complete Friday boundary before storing credentials.
    await verifyGscDates(read, gscPeriod());
    await gscDatabase('configure', { owner, credentials });
    const result = await syncGsc(read);
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof SyntaxError ? 'File JSON không hợp lệ.' : error instanceof Error ? error.message : 'Không kết nối được GSC.' }, { status: 400, headers });
  }
}
