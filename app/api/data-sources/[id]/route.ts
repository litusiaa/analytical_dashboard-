import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const id = BigInt(params.id);
  const url = new URL(req.url);
  const cascade = url.searchParams.get('cascade') === 'true' || url.searchParams.get('force') === 'true';

  const widgets = await prisma.widget.findMany({ where: { dataSourceId: id }, select: { id: true, title: true } });
  if (widgets.length > 0 && !cascade) {
    return NextResponse.json({ code: 'IN_USE', widgets }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    if (widgets.length > 0 && cascade) {
      await tx.widget.updateMany({ where: { dataSourceId: id }, data: { status: 'deleted' as any, deleted_at: new Date() } as any });
    }
    await tx.dataSource.update({ where: { id }, data: { status: 'deleted' as any, deleted_at: new Date() } as any });
  });
  return NextResponse.json({ ok: true, id: Number(id) });
}

