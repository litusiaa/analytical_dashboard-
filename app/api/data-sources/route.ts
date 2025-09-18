import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseSpreadsheetIdFromUrl } from '@/lib/googleSheets';

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const canEdit = /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
    const where: any = canEdit ? {} : { status: 'published' };
    // If legacy DB without DataSourceSheet, avoid include to prevent P2021
    let includeSheets = true;
    try {
      await prisma.dataSourceSheet.count({ where: { id: { gt: BigInt(0) } } });
    } catch {
      includeSheets = false;
    }
    const list = await prisma.dataSource.findMany({ where, orderBy: { createdAt: 'desc' }, include: includeSheets ? { sheets: true } : undefined as any });
    const { serializeJsonSafe } = await import('@/lib/json');
    return NextResponse.json({ items: serializeJsonSafe(list) });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const details = e?.code ? { code: e.code } : undefined;
    return NextResponse.json({ error: msg, details }, { status: 500 });
  }
}

export async function POST(req: Request) {
  // legacy admin-only endpoint; UI doesn't use it now
  if (!authorized(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const type = body?.type as string;
  const name = body?.name as string;
  const description = body?.description as string | undefined;
  let spreadsheetId: string | undefined = body?.spreadsheetId;
  const defaultRange = body?.defaultRange as string | undefined;

  if (body?.spreadsheetUrl && !spreadsheetId) {
    const parsed = parseSpreadsheetIdFromUrl(body.spreadsheetUrl);
    if (parsed) spreadsheetId = parsed;
  }

  if (!type || !name) return NextResponse.json({ message: 'type and name are required' }, { status: 400 });
  if (type === 'google_sheets' && !spreadsheetId) return NextResponse.json({ message: 'spreadsheetId or spreadsheetUrl is required' }, { status: 400 });

  const item = await prisma.dataSource.create({
    data: { type, name, description: description ?? null, spreadsheetId: spreadsheetId ?? null, defaultRange: defaultRange ?? null },
  });
  return NextResponse.json({ id: item.id });
}

