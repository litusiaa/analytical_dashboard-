import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const cookie = req.headers.get('cookie') || '';
  const canEdit = /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
  const where: any = { dashboard: slug };
  if (!canEdit) where.status = 'published';
  const items = await prisma.widget.findMany({ where, orderBy: { order: 'asc' } });
  return NextResponse.json({ items });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
    const slug = params.slug;
    if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const { type, title, dataSourceId, config } = body || {};
    if (!type || !title) return NextResponse.json({ message: 'type and title are required' }, { status: 400 });
    const item = await prisma.widget.create({ data: { dashboard: slug, type, title, dataSourceId: dataSourceId ? BigInt(dataSourceId) : null, config: config ?? null, status: 'draft' } });
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const details = e?.code ? { code: e.code } : undefined;
    return NextResponse.json({ error: msg, details }, { status: 500 });
  }
}

