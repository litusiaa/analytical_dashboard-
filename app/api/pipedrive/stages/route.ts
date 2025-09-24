import { NextResponse } from 'next/server';
import { fetchStages } from '@/lib/pipedrive';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pipelineId = url.searchParams.get('pipelineId');
    const items = await fetchStages();
    const filtered = pipelineId ? items.filter((s)=> String(s.pipeline_id) === String(pipelineId)) : items;
    return NextResponse.json({ items: filtered }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


