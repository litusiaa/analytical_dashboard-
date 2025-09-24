import { NextResponse } from 'next/server';
import { fetchFields } from '@/lib/pipedrive';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entity = (url.searchParams.get('entity') || 'deals') as any;
    const fields = await fetchFields(entity);
    return NextResponse.json({ items: fields }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


