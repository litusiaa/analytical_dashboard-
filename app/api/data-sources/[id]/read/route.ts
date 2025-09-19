import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readValues } from '@/lib/googleSheets';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const sheet = url.searchParams.get('sheet') || '';
  let range = url.searchParams.get('range') || 'A1:Z';
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || '50')));

  const id = BigInt(params.id);
  const ds = await prisma.dataSource.findUnique({ where: { id } });
  if (!ds) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (ds.type !== 'google_sheets') return NextResponse.json({ error: 'Unsupported source type' }, { status: 400 });
  if (!sheet) return NextResponse.json({ error: 'sheet is required' }, { status: 400 });
  if (!range) return NextResponse.json({ error: 'range is required' }, { status: 400 });
  if (/!/.test(range)) range = range.split('!')[1];
  if (!ds.spreadsheetId) return NextResponse.json({ error: 'No spreadsheetId set' }, { status: 400 });

  try {
    const values = await readValues(ds.spreadsheetId, `${sheet}!${range}`);
    const columns = values[0] || [];
    const rows = values.slice(1, 1 + limit);
    const payload = { columns, rows, total: values.length > 0 ? values.length - 1 : 0, lastSyncedAt: ds.lastSyncedAt ? ds.lastSyncedAt.toISOString?.() : undefined } as any;
    return new NextResponse(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    const msg = String(e?.message || e || 'Read error');
    if (/403|PERMISSION/i.test(msg)) return NextResponse.json({ error: `Нет доступа к таблице` }, { status: 403 });
    if (/A1|range|invalid/i.test(msg)) return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

