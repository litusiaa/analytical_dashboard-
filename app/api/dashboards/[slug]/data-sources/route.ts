import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const links = await prisma.dashboardDataSourceLink.findMany({ where: { dashboard: slug }, include: { dataSource: true }, orderBy: { id: 'desc' } });
  return NextResponse.json({ items: links });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!authorized(req)) return NextResponse.json({ message: 'Invalid or missing SYNC_SECRET' }, { status: 401 });
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  // Two modes: attach existing source OR create from URL with sheets list
  if (body?.dataSourceId) {
    const dataSourceId = Number(body.dataSourceId);
    const link = await prisma.dashboardDataSourceLink.create({ data: { dashboard: slug, dataSourceId: BigInt(dataSourceId) } });
    return NextResponse.json({ id: link.id });
  }

  if (body?.spreadsheetUrl) {
    // create datasource + optional sheets
    const { name, spreadsheetUrl, sheets } = body as { name?: string; spreadsheetUrl: string; sheets?: Array<{ title: string; range?: string }> };
    const { parseSpreadsheetIdFromUrl } = await import('@/lib/googleSheets');
    const spreadsheetId = parseSpreadsheetIdFromUrl(spreadsheetUrl);
    if (!spreadsheetId) return NextResponse.json({ message: 'Invalid Google Sheets URL' }, { status: 400 });

    const ds = await prisma.dataSource.create({ data: { type: 'google_sheets', name: name || 'Google Sheet', spreadsheetId } });
    if (sheets?.length) {
      await prisma.dataSourceSheet.createMany({ data: sheets.map((s) => ({ dataSourceId: ds.id, title: s.title, range: s.range ?? null })) });
    }
    const link = await prisma.dashboardDataSourceLink.create({ data: { dashboard: slug, dataSourceId: ds.id } });
    return NextResponse.json({ id: link.id, dataSourceId: ds.id });
  }

  return NextResponse.json({ message: 'Provide dataSourceId or spreadsheetUrl' }, { status: 400 });
}

