import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readValues } from '@/lib/googleSheets';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const sheet = url.searchParams.get('sheet') || '';
  let range = url.searchParams.get('range') || 'A1:Z';
  if (/!/.test(range)) range = range.split('!')[1];
  const id = BigInt(params.id);
  const ds = await prisma.dataSource.findUnique({ where: { id } });
  if (!ds) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!sheet) return NextResponse.json({ error: 'sheet is required' }, { status: 400 });
  if (!ds.spreadsheetId) return NextResponse.json({ error: 'No spreadsheetId set' }, { status: 400 });
  try {
    const values = await readValues(ds.spreadsheetId, `${sheet}!${range}`);
    const columns = (values[0] || []).map((c: any) => String(c));
    const rows = values.slice(1);
    function inferType(v: any): 'number'|'date'|'boolean'|'string' {
      if (v === null || v === undefined || v === '') return 'string';
      if (typeof v === 'number') return 'number';
      const s = String(v).trim();
      if (/^(true|false)$/i.test(s)) return 'boolean';
      const n = Number(s.replace(',', '.'));
      if (!Number.isNaN(n) && /^-?\d{1,3}([\.,]\d+)?$/.test(s) || /^-?\d+$/.test(s)) return 'number';
      const t = Date.parse(s); if (!Number.isNaN(t)) return 'date';
      return 'string';
    }
    const colTypes: Record<string, string> = {};
    for (let ci = 0; ci < columns.length; ci++) {
      let type: string = 'string';
      for (let ri = 0; ri < Math.min(rows.length, 50); ri++) {
        const vt = inferType(rows[ri]?.[ci]);
        if (vt !== 'string') { type = vt; break; }
      }
      colTypes[columns[ci]] = type;
    }
    const distinct: Record<string, any[]> = {};
    for (let ci = 0; ci < columns.length; ci++) {
      const seen = new Set<string>();
      const arr: any[] = [];
      for (let ri = 0; ri < rows.length && arr.length < 100; ri++) {
        const raw = rows[ri]?.[ci];
        const key = String(raw ?? '');
        if (!seen.has(key)) { seen.add(key); arr.push(raw); }
      }
      distinct[columns[ci]] = arr;
    }
    return NextResponse.json({ columns: columns.map((k) => ({ key: k, type: colTypes[k] })), distinct }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    const msg = String(e?.message || e || 'Preview error');
    if (/403|PERMISSION/i.test(msg)) return NextResponse.json({ error: `Нет доступа к таблице` }, { status: 403 });
    if (/A1|range|invalid/i.test(msg)) return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


