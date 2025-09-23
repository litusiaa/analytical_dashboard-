import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function DELETE(req: Request, { params }: { params: { slug: string; id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const id = BigInt(params.id);
  const url = new URL(req.url);
  const hard = url.searchParams.get('hard') === 'true';
  if (hard) {
    await prisma.widget.delete({ where: { id } });
    return NextResponse.json({ ok: true, id: Number(id) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const cols: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name IN ('deletedAt','deleted_at')");
  const hasCamel = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deletedAt');
  const data: any = { status: 'deleted' };
  if (hasCamel) data.deletedAt = new Date(); else (data as any).deleted_at = new Date();
  await prisma.widget.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: Number(id) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

export async function PUT(req: Request, { params }: { params: { slug: string; id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const id = BigInt(params.id);
  const body = await req.json().catch(() => ({}));
  if (body?.action === 'publish') {
    await prisma.widget.update({ where: { id }, data: { status: 'published' as any } as any });
  } else if (body?.action === 'unpublish') {
    await prisma.widget.update({ where: { id }, data: { status: 'draft' as any } as any });
  } else if (body?.config) {
    // update config (replace)
    await prisma.widget.update({ where: { id }, data: { config: body.config as any } as any });
  } else if (body?.status && (body.status === 'published' || body.status === 'draft')) {
    await prisma.widget.update({ where: { id }, data: { status: body.status as any } as any });
  }
  const item = await prisma.widget.findUnique({ where: { id } });
  return NextResponse.json(item, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

export async function PATCH(req: Request, { params }: { params: { slug: string; id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const id = BigInt(params.id);
  const body = await req.json().catch(() => ({}));
  const action = body?.action || 'restore';
  if (action !== 'restore') return NextResponse.json({ message: 'Unsupported action' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const cols: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name IN ('deletedAt','deleted_at')");
  const hasCamel = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deletedAt');
  const data: any = { status: 'draft' };
  if (hasCamel) data.deletedAt = null; else (data as any).deleted_at = null;
  await prisma.widget.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: Number(id) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}


