import { NextResponse } from 'next/server';
import { fetchFilters } from '@/lib/pipedrive';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entity = (url.searchParams.get('entity') || 'deals') as any;
    const items = await fetchFilters(entity);
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


