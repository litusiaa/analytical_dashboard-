import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function POST(req: Request) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const type = body?.type as 'widget' | 'dataSource';
  const id = BigInt(body?.id);
  if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 });
  if (type === 'widget') {
    await prisma.widget.update({ where: { id }, data: { status: 'draft' as any, deleted_at: null } as any });
  } else {
    await prisma.dataSource.update({ where: { id }, data: { status: 'draft' as any, deleted_at: null } as any });
  }
  return NextResponse.json({ ok: true });
}


