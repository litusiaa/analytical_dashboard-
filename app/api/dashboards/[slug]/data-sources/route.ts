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
  const links = await prisma.dashboardDataSourceLink.findMany({ where: { dashboard: slug }, include: { dataSource: true }, orderBy: { id: 'desc' } });
  const items = canEdit ? links : links.filter((l) => l.dataSource?.status === 'published');
  const { serializeJsonSafe } = await import('@/lib/json');
  return NextResponse.json({ items: serializeJsonSafe(items) });
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
        let ds: any;
        try {
          ds = await tx.dataSource.create({ data: { type: 'google_sheets', name: name || 'Google Sheet', spreadsheetId, status: 'draft' } });
        } catch (err: any) {
          const msg = String(err?.message || err);
          if (msg.includes('column') && msg.includes('status')) {
            const rows: Array<{ id: bigint; name: string }>[] = await tx.$queryRawUnsafe(
              'INSERT INTO "DataSource" ("type","name","spreadsheetId") VALUES ($1,$2,$3) RETURNING "id","name"',
              'google_sheets',
              name || 'Google Sheet',
              spreadsheetId,
            ) as any;
            const row = Array.isArray(rows) ? (rows[0] as any) : rows;
            ds = { id: row.id, name: row.name };
          } else {
            throw err;
          }
        }
        if (sheets?.length) {
          const normalized = sheets.map((s) => normalizeSheetInput(s)).map((s) => ({ dataSourceId: ds.id, title: s.title, range: s.range ?? null }));
          await tx.dataSourceSheet.createMany({ data: normalized });
        }
        const link = await tx.dashboardDataSourceLink.create({ data: { dashboard: slug, dataSourceId: ds.id } });
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

