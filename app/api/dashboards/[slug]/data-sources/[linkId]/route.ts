import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function DELETE(req: Request, { params }: { params: { linkId: string } }) {
  if (!authorized(req)) return NextResponse.json({ message: 'Invalid or missing SYNC_SECRET' }, { status: 401 });
  await prisma.dashboardDataSourceLink.delete({ where: { id: BigInt(params.linkId) } });
  return NextResponse.json({ ok: true });
}

