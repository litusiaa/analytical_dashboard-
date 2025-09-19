import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function DELETE(req: Request) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const idStr = url.searchParams.get('id');
  if (!type || !idStr) return NextResponse.json({ error: 'type and id required' }, { status: 400 });
  const id = BigInt(idStr);
  if (type === 'widget') {
    await prisma.widget.delete({ where: { id } });
  } else {
    await prisma.dataSource.delete({ where: { id } });
  }
  return NextResponse.json({ ok: true });
}


