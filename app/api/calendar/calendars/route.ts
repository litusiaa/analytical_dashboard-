import { NextResponse } from 'next/server';
import { listCalendars, TZ } from '@/lib/googleCalendar';

export async function GET() {
  try {
    const items = await listCalendars();
    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = (e as any)?.status || 500;
    const body = status===403 ? { error: 'Нет доступа к календарям. Дайте доступ аккаунту Виолетты или разрешите доменный просмотр.' } : { error: msg };
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


