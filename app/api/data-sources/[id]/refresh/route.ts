import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { getSheetsAuth } from '@/lib/googleAuth';

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!authorized(req)) return NextResponse.json({ message: 'Invalid or missing SYNC_SECRET' }, { status: 401 });
  const id = BigInt(params.id);
  const ds = await prisma.dataSource.findUnique({ where: { id } });
  if (!ds || !ds.spreadsheetId) return NextResponse.json({ message: 'Not found or not Google Sheets' }, { status: 404 });

  const auth = getSheetsAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ds.spreadsheetId });
  const list = (meta.data.sheets || []).map((s) => ({ title: s.properties?.title || 'Лист', range: 'A1:Z' }));

  // sync sheets listing (simple replace)
  await prisma.$transaction([
    prisma.dataSourceSheet.deleteMany({ where: { dataSourceId: ds.id } }),
    prisma.dataSourceSheet.createMany({ data: list.map((s) => ({ dataSourceId: ds.id, title: s.title, range: s.range })) }),
    prisma.dataSource.update({ where: { id: ds.id }, data: { lastSyncedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, sheets: list.length });
}

