import { timingSafeEqual } from 'node:crypto';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const allowed = new Set(['project', 'projectKeywords', 'projectDomains', 'projectSearchEngines', 'projectLastSchedule', 'projectSchedules', 'statistic']);
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (!process.env.CRON_SECRET || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return Response.json({error:'Unauthorized'}, {status:401});
  const url = new URL(request.url);
  const method = url.searchParams.get('method') || 'projectKeywords';
  if (!allowed.has(method)) return Response.json({error:'Read-only method required'}, {status:400});
  const params = JSON.parse(url.searchParams.get('params') || '{}');
  const response = await fetch('https://spyserp.com/panel/api', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...params,token:process.env.SPYSERP_API_KEY,method,project_id:Number(process.env.SPYSERP_PROJECT_ID)}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  return Response.json({status:response.status,data:await response.json()}, {headers:{'Cache-Control':'private, no-store'}});
}
