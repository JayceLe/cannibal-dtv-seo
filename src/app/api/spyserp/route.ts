import { timingSafeEqual } from 'node:crypto';
import { syncSpyserp } from '@/lib/spyserp-sync';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (!process.env.CRON_SECRET || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return Response.json({error:'Unauthorized'}, {status:401});
  try {
    const result=await syncSpyserp(new URL(request.url).searchParams.get('mode')==='verify');
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    return Response.json({ok:false,error:error instanceof Error?error.message:'SpySERP sync failed'}, {status:502,headers:{'Cache-Control':'private, no-store'}});
  }
}
