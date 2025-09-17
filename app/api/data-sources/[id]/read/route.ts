import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readValues } from '@/lib/googleSheets';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = BigInt(params.id);
  const ds = await prisma.dataSource.findUnique({ where: { id } });
  if (!ds) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (ds.type !== 'google_sheets') return NextResponse.json({ message: 'Unsupported source type' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const range = (body?.range as string | undefined) || ds.defaultRange || 'A1:Z1000';
  if (!ds.spreadsheetId) return NextResponse.json({ message: 'No spreadsheetId set' }, { status: 400 });

  try {
    const values = await readValues(ds.spreadsheetId, range);
    const header = values[0] || [];
    return NextResponse.json({ rows: values, headerDetection: header });
  } catch (e: any) {
    const msg = String(e?.message || e || 'Read error');
    const status = msg.includes('403') ? 403 : msg.includes('404') ? 404 : 500;
    return NextResponse.json({ message: msg }, { status });
  }
}

