import { NextResponse } from 'next/server';

export async function GET() {
  const hasClientId = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID);
  return NextResponse.json({ ok: true, hasClientId }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}


