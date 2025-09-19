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
      // Support both deletedAt and deleted_at depending on DB schema
      const col: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name IN ('deletedAt','deleted_at')");
      const hasCamel = Array.isArray(col) && col.some((c: any) => c.column_name === 'deletedAt');
      const data: any = { status: 'deleted' };
      if (hasCamel) data.deletedAt = new Date(); else (data as any).deleted_at = new Date();
      await tx.widget.updateMany({ where: { dataSourceId: id }, data });
    }
    const col2: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource' AND column_name IN ('deletedAt','deleted_at')");
    const hasCamel2 = Array.isArray(col2) && col2.some((c: any) => c.column_name === 'deletedAt');
    const data2: any = { status: 'deleted' };
    if (hasCamel2) data2.deletedAt = new Date(); else (data2 as any).deleted_at = new Date();
    await tx.dataSource.update({ where: { id }, data: data2 });
  });
  return NextResponse.json({ ok: true, id: Number(id) });
}

