// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const widgets = Array.isArray(body?.widgets) ? body.widgets : [];
  const ids = widgets.map((w: any) => BigInt(w.id || w.widgetId)).filter(Boolean);
  const existing = await prisma.widget.findMany({ where: { dashboard: slug, id: { in: ids as any } }, select: { id: true, status: true } });
  const existingIds = new Set(existing.map(w => String(w.id)));
  const ops = widgets
    .filter((w: any) => existingIds.has(String(w.id || w.widgetId)))
    .map((w: any) => prisma.widgetLayout.upsert({
      where: { widgetId_kind: { widgetId: BigInt(w.id || w.widgetId), kind: 'draft' } as any },
      update: { x: Math.round(w.x||0), y: Math.round(w.y||0), width: Math.round(w.width||0), height: Math.round(w.height||0), zIndex: Math.round(w.zIndex||0) },
      create: { widgetId: BigInt(w.id || w.widgetId), kind: 'draft', x: Math.round(w.x||0), y: Math.round(w.y||0), width: Math.round(w.width||0), height: Math.round(w.height||0), zIndex: Math.round(w.zIndex||0) },
    }));
  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

