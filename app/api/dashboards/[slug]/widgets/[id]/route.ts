import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function DELETE(req: Request, { params }: { params: { slug: string; id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const id = BigInt(params.id);
  await prisma.widget.update({ where: { id }, data: { status: 'deleted' as any, deleted_at: new Date() } as any });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: { params: { slug: string; id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const id = BigInt(params.id);
  const body = await req.json().catch(() => ({}));
  if (body?.action === 'publish') {
    await prisma.widget.update({ where: { id }, data: { status: 'published' as any } as any });
  } else if (body?.action === 'unpublish') {
    await prisma.widget.update({ where: { id }, data: { status: 'draft' as any } as any });
  }
  const item = await prisma.widget.findUnique({ where: { id } });
  return NextResponse.json(item);
}

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

