import { NextResponse } from 'next/server';
import { fetchPipelines } from '@/lib/pipedrive';

export async function GET() {
  try {
    const items = await fetchPipelines();
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


