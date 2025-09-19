import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function DELETE(req: Request, { params }: { params: { slug: string; id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const id = BigInt(params.id);
  const cols: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name IN ('deletedAt','deleted_at')");
  const hasCamel = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deletedAt');
  const data: any = { status: 'deleted' };
  if (hasCamel) data.deletedAt = new Date(); else (data as any).deleted_at = new Date();
  await prisma.widget.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id: Number(id) });
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


