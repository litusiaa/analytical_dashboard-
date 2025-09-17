import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!authorized(_req)) return NextResponse.json({ message: 'Invalid or missing SYNC_SECRET' }, { status: 401 });
  const id = BigInt(params.id);
  await prisma.dashboardDataSourceLink.deleteMany({ where: { dataSourceId: id } });
  await prisma.widget.updateMany({ where: { dataSourceId: id }, data: { dataSourceId: null } });
  await prisma.dataSource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

