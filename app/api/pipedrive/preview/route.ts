import { NextResponse } from 'next/server';
import { pipedrivePreview } from '@/lib/pipedrive';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entity = (url.searchParams.get('entity') || 'deals') as any;
    const limit = Number(url.searchParams.get('limit') || '5');
    const cfg: any = {};
    const getJson = (name: string) => { try { const v = url.searchParams.get(name); return v ? JSON.parse(v) : undefined; } catch { return undefined; } };
    const getCsvNum = (name: string) => { const v = url.searchParams.get(name); return v ? v.split(',').map((x)=> Number(x.trim())).filter((n)=> !Number.isNaN(n)) : undefined; };
    cfg.pipelineId = url.searchParams.get('pipelineId') ? Number(url.searchParams.get('pipelineId')) : undefined;
    cfg.stageIds = getCsvNum('stageIds');
    cfg.ownerIds = getCsvNum('ownerIds');
    cfg.dateField = url.searchParams.get('dateField') || undefined;
    cfg.dateFrom = url.searchParams.get('dateFrom') || undefined;
    cfg.dateTo = url.searchParams.get('dateTo') || undefined;
    cfg.fields = getJson('fields') || undefined;
    cfg.savedFilterId = url.searchParams.get('savedFilterId') ? Number(url.searchParams.get('savedFilterId')) : undefined;
    const data = await pipedrivePreview(entity, cfg, limit);
    return NextResponse.json({ columns: data.columns, sample: data.sample }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


