import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function GET(req: Request) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || 'ds';
  const linkCols = await prisma.$queryRawUnsafe<any[]>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink'");
  const hasStatus = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'status');
  const hasCamel = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'deletedAt');
  const hasSnake = Array.isArray(linkCols) && linkCols.some((c: any) => c.column_name === 'deleted_at');
  const dsCols = await prisma.$queryRawUnsafe<any[]>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource'");
  const hasDsStatus = Array.isArray(dsCols) && dsCols.some((c: any) => c.column_name === 'status');
  const links = await prisma.dashboardDataSourceLink.findMany({
    where: { dashboard: slug },
    select: ({ id: true, dataSourceId: true, ...(hasStatus ? { status: true } : {}), ...(hasCamel ? { deletedAt: true } : {}), ...(hasSnake ? { deleted_at: true } : {}), dataSource: { select: ({ id: true, ...(hasDsStatus ? { status: true } : {}) } as any) } } as any),
    orderBy: { id: 'desc' },
  });
  const items = (links as any[]).map((l: any) => {
    const linkStatus = hasStatus ? l.status : ((hasCamel && l.deletedAt) || (hasSnake && l.deleted_at)) ? 'deleted' : 'active';
    return { linkId: Number(l.id), dataSourceId: Number(l.dataSourceId), linkStatus, dsStatus: l.dataSource?.status ?? null };
  });
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}


