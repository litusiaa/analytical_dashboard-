// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const cookie = req.headers.get('cookie') || '';
  const canEdit = /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
  const widgets = await prisma.widget.findMany({
    where: {
      dashboard: slug,
      OR: [
        { status: 'draft' },
        { status: 'published' },
      ],
    },
    select: { id: true }
  });
  const widgetIds = widgets.map(w => w.id);
  if (widgetIds.length === 0) {
    return NextResponse.json({ widgets: [], updatedAt: null }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
  const kind = canEdit ? 'draft' : 'published';
  const layouts = await prisma.widgetLayout.findMany({ where: { widgetId: { in: widgetIds as any }, kind: canEdit ? 'draft' : 'published' } });
  // Fallback to published if draft missing for some widgets
  const publishedFallback = canEdit ? await prisma.widgetLayout.findMany({ where: { widgetId: { in: widgetIds as any }, kind: 'published' } }) : [];
  const byWidget: Record<string, any> = {};
  for (const l of publishedFallback) byWidget[String(l.widgetId)] = l;
  for (const l of layouts) byWidget[String(l.widgetId)] = l;
  const items = Object.entries(byWidget).map(([widgetId, l]) => ({
    widgetId: Number(widgetId),
    x: l.x, y: l.y, width: l.width, height: l.height, zIndex: l.zIndex ?? 0, kind: l.kind,
  }));
  const updatedAt = items.length > 0 ? new Date(Math.max(...layouts.concat(publishedFallback).map(l => new Date(l.updatedAt).getTime()))).toISOString() : null;
  return NextResponse.json({ widgets: items, updatedAt }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

