import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const cookie = req.headers.get('cookie') || '';
  const canEdit = /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
  // If we are in view mode and DB has status column, filter by published
  let items: any[] = [];
  const cols = await prisma.$queryRawUnsafe<any[]>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource' AND column_name IN ('status','lastSyncedAt')"
  );
  const hasStatusCol = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'status');
  const hasLastSyncedAt = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'lastSyncedAt');

  if (!canEdit && hasStatusCol) {
    const links = await prisma.dashboardDataSourceLink.findMany({
      where: { dashboard: slug, dataSource: { status: 'published' as any } },
      select: { id: true, dataSourceId: true, dataSource: { select: { id: true, name: true, type: true, status: true, ...(hasLastSyncedAt ? { lastSyncedAt: true } : {}) } as any } },
      orderBy: { id: 'desc' },
    });
    items = links as any[];
  } else {
    const links = await prisma.dashboardDataSourceLink.findMany({
      where: { dashboard: slug },
      select: { id: true, dataSourceId: true, dataSource: { select: { id: true, name: true, type: true, ...(hasStatusCol ? { status: true } : {}), ...(hasLastSyncedAt ? { lastSyncedAt: true } : {}) } as any } },
      orderBy: { id: 'desc' },
    });
    items = links as any[];
  }
  const { serializeJsonSafe } = await import('@/lib/json');
  return NextResponse.json({ items: serializeJsonSafe(items) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({}));

    // Two modes: attach existing source OR create from URL with sheets list
    if (body?.dataSourceId) {
      const dataSourceId = Number(body.dataSourceId);
      const link = await prisma.dashboardDataSourceLink.create({ data: { dashboard: slug, dataSourceId: BigInt(dataSourceId) } });
      return NextResponse.json({ id: link.id }, { status: 201 });
    }

    if (body?.spreadsheetUrl) {
      // create datasource + optional sheets
      const { name, spreadsheetUrl, sheets } = body as { name?: string; spreadsheetUrl: string; sheets?: Array<{ title?: string; range?: string }> };
      const { parseSpreadsheetIdFromUrl } = await import('@/lib/googleSheets');
      const spreadsheetId = parseSpreadsheetIdFromUrl(spreadsheetUrl);
      if (!spreadsheetId) return NextResponse.json({ message: 'Invalid Google Sheets URL' }, { status: 400 });

      const result = await prisma.$transaction(async (tx) => {
        // Detect if legacy DB without `status` column
        const col: any[] = (await tx.$queryRawUnsafe(
          "SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DataSource' AND column_name = 'status' LIMIT 1"
        )) as any[];
        const hasStatus = Array.isArray(col) && col.length > 0;

        let ds: any;
        if (hasStatus) {
          ds = await tx.dataSource.create({ data: { type: 'google_sheets', name: name || 'Google Sheet', spreadsheetId, status: 'draft' } });
        } else {
          const cols: any[] = (await tx.$queryRawUnsafe(
            "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DataSource'"
          )) as any[];
          const needsUpdatedAt = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'updatedAt' && c.is_nullable === 'NO');
          const insertCols: string[] = ['"type"','"name"','"spreadsheetId"'];
          let valuesClause = '$1,$2,$3';
          if (needsUpdatedAt) { insertCols.push('"updatedAt"'); valuesClause += ', NOW()'; }
          const sql = `INSERT INTO "DataSource" (${insertCols.join(',')}) VALUES (${valuesClause}) RETURNING "id","name"`;
          const rows: any[] = (await tx.$queryRawUnsafe(
            sql,
            'google_sheets',
            name || 'Google Sheet',
            spreadsheetId,
          )) as any[];
          const row = rows?.[0] ?? rows;
          ds = { id: row.id, name: row.name };
        }
        const dsId: bigint = typeof ds.id === 'bigint' ? ds.id : BigInt(String(ds.id));
        if (sheets?.length) {
          const t: any[] = (await tx.$queryRawUnsafe(
            "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'DataSourceSheet' LIMIT 1"
          )) as any[];
          const hasSheetsTable = Array.isArray(t) && t.length > 0;
          if (hasSheetsTable) {
            const normalized = sheets.map((s) => normalizeSheetInput(s)).map((s) => ({ dataSourceId: dsId, title: s.title, range: s.range ?? null }));
            await tx.dataSourceSheet.createMany({ data: normalized });
          }
        }
        const link = await tx.dashboardDataSourceLink.create({ data: { dashboard: slug, dataSourceId: dsId } });
        // Auto-create a table widget for the first selected sheet, if any
        if (sheets && sheets.length > 0) {
          const first = normalizeSheetInput(sheets[0]);
          const hasWidgetStatus = await tx.$queryRawUnsafe<any[]>(
            "SELECT 1 AS ok FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name='status' LIMIT 1"
          );
          const widgetData: any = {
            dashboard: slug,
            type: 'table',
            title: `Table — ${first.title}`,
            dataSourceId: dsId,
            config: { dataSourceId: Number(dsId), sheetTitle: first.title, range: first.range || 'A1:Z', options: { pageSize: 50 } },
          };
          if (Array.isArray(hasWidgetStatus) && hasWidgetStatus.length > 0) widgetData.status = 'draft';
          await tx.widget.create({ data: widgetData });
        }
        return { ds, link };
      });
      const id = Number(result.link.id);
      const dataSourceId = Number(result.ds.id);
      return NextResponse.json({ id, dataSourceId, name: result.ds.name }, { status: 201 });
    }

    return NextResponse.json({ message: 'Provide dataSourceId or spreadsheetUrl' }, { status: 400 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const details = e?.code ? { code: e.code } : undefined;
    const status = e?.statusCode === 422 ? 422 : 500;
    return NextResponse.json({ error: msg, details }, { status });
  }
}

function normalizeSheetInput(s: { title?: string; range?: string }): { title: string; range?: string } {
  const rawTitle = s.title?.trim();
  const rawRange = (s.range || '').trim();
  if (!rawTitle && !rawRange) throw new Error('Sheet title or range is required');
  // Cases:
  // 1) range = "A1:Z" and title provided → ok
  // 2) range = "Sheet!A1:Z" and title missing → split
  // 3) range = "Sheet!A1:Z" and title provided → prefer explicit title, strip prefix if matches
  let title = rawTitle || '';
  let range = rawRange || undefined;
  const m = rawRange.match(/^([^!]+)!([A-Za-z]+\d*:[A-Za-z]+\d*)$/);
  if (!title && m) {
    title = m[1];
    range = m[2];
  } else if (title && m && m[1] === title) {
    range = m[2];
  }
  // Validate range if present
  if (range && !/^([A-Za-z]+\d*:[A-Za-z]+\d*)$/.test(range)) {
    throw Object.assign(new Error('Invalid range. Use A1:Z or <Sheet>!A1:Z'), { statusCode: 422 });
  }
  if (!title) {
    throw Object.assign(new Error('Invalid range. Use A1:Z or <Sheet>!A1:Z'), { statusCode: 422 });
  }
  return { title, range };
}

