import { NextResponse } from 'next/server';
import { listCalendars } from '@/lib/googleCalendar';

export async function GET() {
  try {
    const items = await listCalendars();
    const mapped = (items || []).map((c: any) => ({ id: c.id, summary: c.summary, primary: Boolean(c.primary), accessRole: c.accessRole, timeZone: c.timeZone }));
    return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    const status = (e as any)?.status || 500;
    const msg = String(e?.message || e);
    return NextResponse.json({ error: msg }, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


