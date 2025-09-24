// @ts-nocheck
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

type Rect = { widgetId: bigint; x: number; y: number; width: number; height: number; zIndex: number };

function snapRect(r: Rect, step: number): Rect {
  const s = Math.max(1, step|0);
  const round = (v: number) => Math.round(v / s) * s;
  return { ...r, x: round(r.x), y: round(r.y), width: Math.max(s, round(r.width)), height: Math.max(s, round(r.height)) };
}

function resolveOverlaps(rects: Rect[]): Rect[] {
  // Greedy vertical separation by y, then x
  const res = rects.slice().sort((a,b) => a.y - b.y || a.x - b.x);
  for (let i=0;i<res.length;i++) {
    for (let j=0;j<i;j++) {
      const A = res[i], B = res[j];
      if (intersect(A,B)) {
        // push A down just below B
        A.y = B.y + B.height + 8;
      }
    }
  }
  return res;
}

function intersect(a: Rect, b: Rect): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

function compactVertically(rects: Rect[]): Rect[] {
  const res = rects.slice().sort((a,b) => a.y - b.y || a.x - b.x);
  for (let i=0;i<res.length;i++) {
    let minY = 0;
    for (let j=0;j<i;j++) {
      const B = res[j];
      if (overlapsX(res[i], B)) {
        minY = Math.max(minY, B.y + B.height + 8);
      }
    }
    res[i].y = Math.max(res[i].y, minY);
  }
  return res;
}

function overlapsX(a: Rect, b: Rect): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x);
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const { snap = 0, resolveOverlaps: resolveFlag = true, compact = true } = await req.json().catch(() => ({}));
  const widgets = await prisma.widget.findMany({ where: { dashboard: slug, status: { in: ['draft','published'] } }, select: { id: true } });
  const ids = widgets.map(w => w.id);
  const drafts = await prisma.widgetLayout.findMany({ where: { widgetId: { in: ids as any }, kind: 'draft' } });
  const base = drafts.length ? drafts : await prisma.widgetLayout.findMany({ where: { widgetId: { in: ids as any }, kind: 'published' } });
  let rects: Rect[] = base.map(l => ({ widgetId: l.widgetId as any, x: l.x, y: l.y, width: l.width, height: l.height, zIndex: l.zIndex ?? 0 }));
  if (snap) rects = rects.map(r => snapRect(r, snap));
  if (resolveFlag) rects = resolveOverlaps(rects);
  if (compact) rects = compactVertically(rects);
  const tx = rects.map(r => prisma.widgetLayout.upsert({ where: { widgetId_kind: { widgetId: r.widgetId, kind: 'draft' } as any }, update: { x: r.x, y: r.y, width: r.width, height: r.height, zIndex: r.zIndex }, create: { widgetId: r.widgetId, kind: 'draft', x: r.x, y: r.y, width: r.width, height: r.height, zIndex: r.zIndex } }));
  await prisma.$transaction(tx);
  return NextResponse.json({ ok: true, changed: rects.length }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}


