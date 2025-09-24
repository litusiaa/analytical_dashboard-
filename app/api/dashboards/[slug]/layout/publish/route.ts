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
  const drafts = await prisma.widgetLayout.findMany({ where: { widgetId: { in: ids as any }, kind: 'draft' } });
  const tx: any[] = [];
  for (const d of drafts) {
    tx.push(prisma.widgetLayout.upsert({ where: { widgetId_kind: { widgetId: d.widgetId, kind: 'published' } as any }, update: { x: d.x, y: d.y, width: d.width, height: d.height, zIndex: d.zIndex }, create: { widgetId: d.widgetId, kind: 'published', x: d.x, y: d.y, width: d.width, height: d.height, zIndex: d.zIndex } }));
  }
  await prisma.$transaction(tx);
  return NextResponse.json({ ok: true, published: drafts.length }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

