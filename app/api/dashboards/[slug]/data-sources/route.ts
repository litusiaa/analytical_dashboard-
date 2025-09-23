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
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const cookie = req.headers.get('cookie') || '';
  const canEdit = /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
  // If we are in view mode and DB has status column, filter by published
  let items: any[] = [];
  const cols = await prisma.$queryRawUnsafe<any[]>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource' AND column_name IN ('status','lastSyncedAt')"
  );
  const hasStatusCol = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'status');
  const hasLastSyncedAt = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'lastSyncedAt');
  const linkCols = await prisma.$queryRawUnsafe<any[]>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink'"
  );
  const hasLinkStatus = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'status');
  const hasLinkDeletedAt = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'deletedAt');
  const hasLinkDeleted_at = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'deleted_at');

  if (!canEdit && hasStatusCol) {
    const links = await prisma.dashboardDataSourceLink.findMany({
      where: { dashboard: slug, dataSource: { status: 'published' as any } },
      select: ({ id: true, dataSourceId: true, ...(hasLinkStatus ? { status: true } : {}), ...(hasLinkDeletedAt ? { deletedAt: true } : {}), ...(hasLinkDeleted_at ? { deleted_at: true } : {}), dataSource: { select: { id: true, name: true, type: true, status: true, ...(hasLastSyncedAt ? { lastSyncedAt: true } : {}) } as any } } as any),
      orderBy: { id: 'desc' },
    });
    let result = (links as any[]).map((l: any) => {
      if (!hasLinkStatus) {
        if ((hasLinkDeletedAt && l.deletedAt) || (hasLinkDeleted_at && l.deleted_at)) l.status = 'deleted';
      }
      delete l.deletedAt; delete l.deleted_at; return l;
    });
    // attach sheets if table exists
    const hasSheetsTbl: any[] = await prisma.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name='DataSourceSheet' LIMIT 1");
    if (Array.isArray(hasSheetsTbl) && hasSheetsTbl.length > 0) {
      const ids = result.map((x: any) => x.dataSourceId);
      if (ids.length > 0) {
        const rows = await prisma.dataSourceSheet.findMany({ where: { dataSourceId: { in: ids } as any }, select: { dataSourceId: true, title: true, range: true } });
        const map = new Map<number, { title: string; range: string | null }[]>();
        for (const r of rows as any[]) {
          const k = Number(r.dataSourceId); const arr = map.get(k) || []; arr.push({ title: r.title, range: r.range }); map.set(k, arr);
        }
        result = result.map((x: any) => ({ ...x, sheets: map.get(Number(x.dataSourceId)) || [] }));
      }
    }
    items = result as any[];
  } else {
    const links = await prisma.dashboardDataSourceLink.findMany({
      where: hasStatusCol ? { dashboard: slug, dataSource: { status: { in: ['draft','published','deleted'] } as any } } as any : { dashboard: slug },
      select: ({ id: true, dataSourceId: true, ...(hasLinkStatus ? { status: true } : {}), ...(hasLinkDeletedAt ? { deletedAt: true } : {}), ...(hasLinkDeleted_at ? { deleted_at: true } : {}), dataSource: { select: { id: true, name: true, type: true, ...(hasStatusCol ? { status: true } : {}), ...(hasLastSyncedAt ? { lastSyncedAt: true } : {}) } as any } } as any),
      orderBy: { id: 'desc' },
    });
    let result = (links as any[]).map((l: any) => {
      if (!hasLinkStatus) {
        if ((hasLinkDeletedAt && l.deletedAt) || (hasLinkDeleted_at && l.deleted_at)) l.status = 'deleted';
      }
      delete l.deletedAt; delete l.deleted_at; return l;
    });
    // attach sheets if table exists
    const hasSheetsTbl: any[] = await prisma.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name='DataSourceSheet' LIMIT 1");
    if (Array.isArray(hasSheetsTbl) && hasSheetsTbl.length > 0) {
      const ids = result.map((x: any) => x.dataSourceId);
      if (ids.length > 0) {
        const rows = await prisma.dataSourceSheet.findMany({ where: { dataSourceId: { in: ids } as any }, select: { dataSourceId: true, title: true, range: true } });
        const map = new Map<number, { title: string; range: string | null }[]>();
        for (const r of rows as any[]) {
          const k = Number(r.dataSourceId); const arr = map.get(k) || []; arr.push({ title: r.title, range: r.range }); map.set(k, arr);
        }
        result = result.map((x: any) => ({ ...x, sheets: map.get(Number(x.dataSourceId)) || [] }));
      }
    }
    items = result as any[];
  }
  const { serializeJsonSafe } = await import('@/lib/json');
  return NextResponse.json(
    { items: serializeJsonSafe(items) },
    { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } }
  );
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

      // Find or create DataSource by spreadsheetId, and ensure link exists (restore if soft-deleted)
      const dsExisting = await prisma.dataSource.findFirst({ where: { spreadsheetId } });
      if (dsExisting) {
        const dsId = typeof dsExisting.id === 'bigint' ? dsExisting.id : BigInt(String(dsExisting.id));
        // ensure link
        const linkCols: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink'");
        const hasStatusL = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'status');
        const hasCamelL = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'deletedAt');
        const hasSnakeL = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'deleted_at');
        let link = await prisma.dashboardDataSourceLink.findFirst({ where: { dashboard: slug, dataSourceId: dsId } });
        if (!link) {
          link = await prisma.dashboardDataSourceLink.create({ data: hasStatusL ? ({ dashboard: slug, dataSourceId: dsId, status: 'draft' } as any) : ({ dashboard: slug, dataSourceId: dsId }) });
        } else {
          // restore if soft-deleted
          const restoreData: any = {};
          if (hasStatusL) restoreData.status = 'draft';
          if (hasCamelL) restoreData.deletedAt = null;
          if (hasSnakeL) (restoreData as any).deleted_at = null;
          if (Object.keys(restoreData).length) {
            await prisma.dashboardDataSourceLink.update({ where: { id: link.id }, data: restoreData });
          }
        }

        // upsert sheets if provided
        if (sheets?.length) {
          const hasSheetsTbl: any[] = await prisma.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name='DataSourceSheet' LIMIT 1");
          if (Array.isArray(hasSheetsTbl) && hasSheetsTbl.length > 0) {
            for (const s of sheets.map(normalizeSheetInput)) {
              const exists = await prisma.dataSourceSheet.findFirst({ where: { dataSourceId: dsId, title: s.title } });
              if (!exists) {
                await prisma.dataSourceSheet.create({ data: { dataSourceId: dsId, title: s.title, range: s.range ?? null } });
              } else if (s.range && (!exists.range || String(s.range).length > String(exists.range).length)) {
                await prisma.dataSourceSheet.update({ where: { id: exists.id }, data: { range: s.range } });
              }
            }
          }
        }

        return NextResponse.json({ id: Number(link!.id), dataSourceId: Number(dsId), name: dsExisting.name }, { status: 201, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Detect if legacy DB without `status` column
        const col: any[] = (await tx.$queryRawUnsafe(
          "SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'DataSource' AND column_name = 'status' LIMIT 1"
        )) as any[];
        const hasStatus = Array.isArray(col) && col.length > 0;

        let ds: any;
        const firstSheetTitle = (sheets && sheets.length > 0) ? normalizeSheetInput(sheets[0]).title : undefined;
        const autoName = name && String(name).trim().length > 0 ? name : (firstSheetTitle ? `Google Sheet — ${firstSheetTitle}` : 'Google Sheet');
        if (hasStatus) {
          ds = await tx.dataSource.create({ data: { type: 'google_sheets', name: autoName, spreadsheetId, status: 'draft' } });
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
            autoName,
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
        // create link with status draft if link has status column
        const lcols: any[] = (await tx.$queryRawUnsafe(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink' AND column_name IN ('status')"
        )) as any[];
        const hasLinkStatus = Array.isArray(lcols) && lcols.some((c: any) => c.column_name === 'status');
        const link = await tx.dashboardDataSourceLink.create({ data: hasLinkStatus ? ({ dashboard: slug, dataSourceId: dsId, status: 'draft' } as any) : ({ dashboard: slug, dataSourceId: dsId }) });
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
      return NextResponse.json({ id, dataSourceId, name: result.ds.name }, { status: 201, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
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

