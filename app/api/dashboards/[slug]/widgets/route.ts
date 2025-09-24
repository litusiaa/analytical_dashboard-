// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const cookie = req.headers.get('cookie') || '';
  const canEdit = /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
  // Filter by status only if column exists in DB
  const hasStatus = await prisma.$queryRawUnsafe<any[]>(
    "SELECT 1 AS ok FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name='status' LIMIT 1"
  );
  const where: any = { dashboard: slug };
  if (Array.isArray(hasStatus) && hasStatus.length > 0) {
    if (!canEdit) {
      where.status = 'published';
    } else {
      where.status = { in: ['draft','published','deleted'] } as any;
    }
  }
  const select: any = { id: true, type: true, title: true, config: true, createdAt: true, updatedAt: true };
  if (Array.isArray(hasStatus) && hasStatus.length > 0) select.status = true;
  const items = await prisma.widget.findMany({ where, orderBy: { order: 'asc' }, select });
  const { serializeJsonSafe } = await import('@/lib/json');
  return NextResponse.json(
    { items: serializeJsonSafe(items) },
    { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } }
  );
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
    const slug = params.slug;
    if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { type, dataSourceId, sheetTitle, range, title, options, mapping } = body || {};
    if (!['table','line','bar','pie','calendar'].includes(type)) return NextResponse.json({ message: 'Unsupported widget type' }, { status: 400 });
    if (!dataSourceId || !sheetTitle) return NextResponse.json({ message: 'dataSourceId and sheetTitle are required' }, { status: 400 });
    // For non-calendar widgets, validate dataSource ownership
    if (type !== 'calendar') {
    const link = await prisma.dashboardDataSourceLink.findFirst({ where: { dashboard: slug, dataSourceId: BigInt(dataSourceId) }, include: { dataSource: true } });
    if (!link || !link.dataSource) return NextResponse.json({ message: 'Data source not linked to this dashboard' }, { status: 400 });
    const spreadsheetId = link.dataSource.spreadsheetId;
    if (!spreadsheetId) return NextResponse.json({ message: 'Data source has no spreadsheetId' }, { status: 400 });
    // Quick validation by reading up to 50 rows (soft fail for non-table types)
    try {
      const { readValues } = await import('@/lib/googleSheets');
      const r = (range && /!/.test(range)) ? range.split('!')[1] : (range || 'A1:Z');
      await readValues(spreadsheetId, `${sheetTitle}!${r}`);
    } catch (e: any) {
      if (type === 'table') {
        const msg = String(e?.message || e);
        const status = /403|PERMISSION/i.test(msg) ? 403 : /A1|range|invalid/i.test(msg) ? 400 : 500;
        return NextResponse.json({ error: msg }, { status });
      }
    }
    const hasStatus = await prisma.$queryRawUnsafe<any[]>(
      "SELECT 1 AS ok FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name='status' LIMIT 1"
    );
    const baseCfg: any = type==='calendar' ? (options || {}) : { dataSourceId, sheetTitle, range: range || 'A1:Z', options: options || { pageSize: 50 } };
    if (type !== 'table' && type !== 'calendar') baseCfg.mapping = mapping || {};
    const data: any = { dashboard: slug, type, title: title || (type==='table' ? `Table — ${sheetTitle}` : `${type[0].toUpperCase()}${type.slice(1)} — ${sheetTitle}`), dataSourceId: BigInt(dataSourceId), config: baseCfg };
    if (Array.isArray(hasStatus) && hasStatus.length > 0) data.status = 'draft';
    const item = await prisma.widget.create({ data });
    const { serializeJsonSafe } = await import('@/lib/json');
    return NextResponse.json(serializeJsonSafe(item), { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const details = e?.code ? { code: e.code } : undefined;
    return NextResponse.json({ error: msg, details }, { status: 500 });
  }
}

