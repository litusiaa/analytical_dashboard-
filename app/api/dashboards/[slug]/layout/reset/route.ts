// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const widgets = await prisma.widget.findMany({ where: { dashboard: slug, status: { in: ['draft','published'] } }, select: { id: true } });
  const ids = widgets.map(w => w.id);
  const published = await prisma.widgetLayout.findMany({ where: { widgetId: { in: ids as any }, kind: 'published' } });
  const tx: any[] = [];
  for (const p of published) {
    tx.push(prisma.widgetLayout.upsert({ where: { widgetId_kind: { widgetId: p.widgetId, kind: 'draft' } as any }, update: { x: p.x, y: p.y, width: p.width, height: p.height, zIndex: p.zIndex }, create: { widgetId: p.widgetId, kind: 'draft', x: p.x, y: p.y, width: p.width, height: p.height, zIndex: p.zIndex } }));
  }
  await prisma.$transaction(tx);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

