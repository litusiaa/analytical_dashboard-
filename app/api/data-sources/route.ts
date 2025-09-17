import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseSpreadsheetIdFromUrl } from '@/lib/googleSheets';

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function GET() {
  const list = await prisma.dataSource.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ items: list });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ message: 'Invalid or missing SYNC_SECRET' }, { status: 401 });
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

