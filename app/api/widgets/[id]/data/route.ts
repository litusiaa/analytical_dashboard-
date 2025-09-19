import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readValues, parseSpreadsheetIdFromUrl } from '@/lib/googleSheets';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || '50')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));

    const id = BigInt(params.id);
    const widget = await prisma.widget.findUnique({ where: { id } });
    if (!widget) return NextResponse.json({ message: 'Widget not found' }, { status: 404 });
    const cfg: any = widget.config || {};
    const dataSource = await prisma.dataSource.findUnique({ where: { id: BigInt(cfg.dataSourceId) } });
    if (!dataSource?.spreadsheetId) return NextResponse.json({ message: 'Invalid data source' }, { status: 400 });
    const sheetTitle: string = cfg.sheetTitle;
    let range: string = cfg.range || 'A1:Z';
    if (/!/.test(range)) range = range.split('!')[1];

    const values = await readValues(dataSource.spreadsheetId, `${sheetTitle}!${range}`);
    const header = values[0] || [];
    const rows = values.slice(1 + offset, 1 + offset + limit);
    return NextResponse.json({ columns: header, rows });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/403|PERMISSION/i.test(msg)) return NextResponse.json({ error: `Нет доступа к таблице` }, { status: 403 });
    if (/A1|range|invalid/i.test(msg)) return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


