import { NextResponse } from 'next/server';
import { listCalendars } from '@/lib/googleCalendar';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = (url.searchParams.get('email') || '').toLowerCase().trim();
    if (!email) return NextResponse.json({ code: 'BAD_REQUEST', message: 'email is required' }, { status: 400 });
    const list = await listCalendars();
    const found = (list || []).find((c: any) => String(c.id||'').toLowerCase() === email || String(c.summary||'').toLowerCase() === email);
    if (!found) return NextResponse.json({ code: 'CAL_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ id: found.id, summary: found.summary, primary: Boolean(found.primary), accessRole: found.accessRole, timeZone: found.timeZone }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    const status = (e as any)?.status || 500;
    const msg = String(e?.message || e);
    return NextResponse.json({ error: msg }, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


