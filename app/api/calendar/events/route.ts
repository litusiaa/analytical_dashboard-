import { NextResponse } from 'next/server';
import { listEvents, TZ } from '@/lib/googleCalendar';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ids = (url.searchParams.get('calendarId') || '').split(',').map(s=> s.trim()).filter(Boolean);
    const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 7*24*3600*1000).toISOString();
    const { items, errors } = await listEvents(ids, timeMin, timeMax);
    return NextResponse.json({ tz: TZ, range: { timeMin, timeMax }, items, total: items.length, errors }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


