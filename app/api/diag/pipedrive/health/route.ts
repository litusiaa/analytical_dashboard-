import { NextResponse } from 'next/server';
import { pipedriveList } from '@/lib/pipedrive';

export async function GET() {
  try {
    // simple call to validate token and quota
    const res = await pipedriveList('deals', { limit: 1, start: 0 });
    return NextResponse.json({ ok: true, items: (res.items || []).length }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


