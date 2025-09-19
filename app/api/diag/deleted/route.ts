import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function GET(req: Request) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || undefined;
  const ds = await prisma.dataSource.findMany({ where: slug ? { status: 'deleted' as any } : { status: 'deleted' as any }, select: { id: true, name: true, status: true, deletedAt: true } as any });
  const ws = await prisma.widget.findMany({ where: slug ? { status: 'deleted' as any, dashboard: slug } as any : { status: 'deleted' as any }, select: { id: true, title: true, status: true, deletedAt: true, dashboard: true } as any });
  return NextResponse.json({ dataSources: ds, widgets: ws }, { headers: { 'Cache-Control': 'no-store' } });
}


