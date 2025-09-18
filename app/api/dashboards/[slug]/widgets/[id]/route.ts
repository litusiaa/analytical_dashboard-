import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  const body = await req.json().catch(() => ({}));
  const config = body?.config ?? null;
  const title = body?.title as string | undefined;
  await prisma.widget.update({ where: { id: BigInt(params.id) }, data: { config, ...(title ? { title } : {}) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  await prisma.widget.delete({ where: { id: BigInt(params.id) } });
  return NextResponse.json({ ok: true });
}

