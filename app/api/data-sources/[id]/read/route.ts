import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readValues } from '@/lib/googleSheets';
import { pipedriveList, buildColumnsFromItems } from '@/lib/pipedrive';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const sheet = url.searchParams.get('sheet') || '';
  let range = url.searchParams.get('range') || 'A1:Z';
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');
  const limit = Math.max(1, Math.min(5000, Number(limitParam || '1000')));
  const offset = Math.max(0, Number(offsetParam || '0'));
  const filtersB64 = url.searchParams.get('filters') || '';

  const id = BigInt(params.id);
  const ds = await prisma.dataSource.findUnique({ where: { id } });
  if (!ds) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (ds.type === 'pipedrive') {
    try {
      // Pipedrive paging (transparent): use offset/limit as start/limit
      const start = offset;
      const limitPD = Math.max(1, Math.min(500, limit));
      let entity: any = (ds as any).entity; let cfg: any = (ds as any).config;
      try { if (!entity || !cfg) { const parsed = (ds as any).description ? JSON.parse(String((ds as any).description)) : null; if (parsed) { entity = parsed.entity; cfg = parsed.config; } } } catch {}
      const json = await pipedriveList(entity || 'deals', { start, limit: limitPD, ...(cfg?.savedFilterId ? { filter_id: cfg.savedFilterId } : {}) });
      const items = json.items || [];
      const columns = buildColumnsFromItems(items);
      const rows = items.map((it: any) => columns.map((c) => it?.[c.key] ?? ''));
      const payload = { columns: columns.map((c)=>c.key), rows, total: undefined, lastSyncedAt: ds.lastSyncedAt ? ds.lastSyncedAt.toISOString?.() : undefined } as any;
      return new NextResponse(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch (e: any) {
      const msg = String(e?.message || e || 'Read error');
      return NextResponse.json({ error: msg }, { status: (e as any)?.status || 500 });
    }
  }
  // Google Sheets branch
  if (!sheet) return NextResponse.json({ error: 'sheet is required' }, { status: 400 });
  if (!range) return NextResponse.json({ error: 'range is required' }, { status: 400 });
  if (/!/.test(range)) range = range.split('!')[1];
  if (!ds.spreadsheetId) return NextResponse.json({ error: 'No spreadsheetId set' }, { status: 400 });

  try {
    const values = await readValues(ds.spreadsheetId, `${sheet}!${range}`);
    const columns = (values[0] || []).map((c: any) => String(c));
    const allRows = values.slice(1);
    // Build row objects keyed by header
    const headerIndex = new Map<string, number>();
    columns.forEach((k: string, i: number) => headerIndex.set(k, i));

    type FilterTree = { op: 'AND' | 'OR'; items: Array<FilterTree | any> };
    type FilterClause = { col: string; type?: string; op: string; value?: any };

    function parseFilters(b64: string | undefined | null): FilterTree | null {
      if (!b64) return null;
      try {
        const json = Buffer.from(String(b64), 'base64').toString('utf8');
        const obj = JSON.parse(json);
        return obj && obj.items ? obj as FilterTree : null;
      } catch {
        return null;
      }
    }

    function inferType(v: any): 'number'|'date'|'boolean'|'string' {
      if (v === null || v === undefined || v === '') return 'string';
      if (typeof v === 'number') return 'number';
      const s = String(v).trim();
      if (/^(true|false)$/i.test(s)) return 'boolean';
      const n = Number(s.replace(',', '.'));
      if (!Number.isNaN(n) && /^-?\d{1,3}([\.,]\d+)?$/.test(s) || /^-?\d+$/.test(s)) return 'number';
      const t = Date.parse(s);
      if (!Number.isNaN(t)) return 'date';
      return 'string';
    }

    function toComparable(v: any, typeHint?: string): any {
      if (v === null || v === undefined) return '';
      const t = (typeHint as any) || inferType(v);
      const s = String(v).trim();
      if (t === 'number') return Number(s.replace(',', '.'));
      if (t === 'boolean') return /^true$/i.test(s);
      if (t === 'date') {
        const ts = Date.parse(s); return Number.isNaN(ts) ? s : ts;
      }
      return s;
    }

    function matchClause(row: any[], clause: FilterClause): boolean {
      const idx = headerIndex.get(clause.col);
      if (idx === undefined) return false;
      const raw = row[idx];
      const type = clause.type || inferType(raw);
      const val = toComparable(raw, type);
      const op = (clause.op || '').toLowerCase();
      const arg = clause.value;
      const argVal = Array.isArray(arg) ? arg.map((x: any) => toComparable(x, type)) : toComparable(arg, type);
      switch (op) {
        case 'equals': case '=': return val === argVal;
        case 'not equals': case '≠': return val !== argVal;
        case '>': return val > argVal;
        case '>=': return val >= argVal;
        case '<': return val < argVal;
        case '<=': return val <= argVal;
        case 'between': return Array.isArray(arg) && arg.length >= 2 ? (val >= argVal[0] && val <= argVal[1]) : true;
        case 'contains': return String(val).toLowerCase().includes(String(argVal).toLowerCase());
        case 'not contains': return !String(val).toLowerCase().includes(String(argVal).toLowerCase());
        case 'startswith': return String(val).toLowerCase().startsWith(String(argVal).toLowerCase());
        case 'endswith': return String(val).toLowerCase().endsWith(String(argVal).toLowerCase());
        case 'in': return Array.isArray(argVal) ? argVal.includes(val) : false;
        case 'not in': return Array.isArray(argVal) ? !argVal.includes(val) : true;
        case 'is empty': return raw === null || raw === undefined || String(raw) === '';
        case 'is not empty': return !(raw === null || raw === undefined || String(raw) === '');
        default: return true;
      }
    }

    function matchTree(row: any[], tree: FilterTree | null): boolean {
      if (!tree) return true;
      const op = (tree.op || 'AND').toUpperCase();
      const results = (tree.items || []).map((it: any) => (
        it && it.items ? matchTree(row, it) : matchClause(row, it as FilterClause)
      ));
      return op === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }

    const filterTree = parseFilters(filtersB64);
    const filteredRows = filterTree ? allRows.filter((r: any[]) => matchTree(r, filterTree)) : allRows;

    const rows = filteredRows.slice(offset, offset + limit);
    const payload = { columns, rows, total: filteredRows.length, lastSyncedAt: ds.lastSyncedAt ? ds.lastSyncedAt.toISOString?.() : undefined } as any;
    return new NextResponse(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    const msg = String(e?.message || e || 'Read error');
    if (/403|PERMISSION/i.test(msg)) return NextResponse.json({ error: `Нет доступа к таблице` }, { status: 403 });
    if (/A1|range|invalid/i.test(msg)) return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

