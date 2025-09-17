import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SLUGS = new Set(['pm','ds','csm','finance','partner','sales']);

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const links = await prisma.dashboardDataSourceLink.findMany({ where: { dashboard: slug }, include: { dataSource: true }, orderBy: { id: 'desc' } });
  return NextResponse.json({ items: links });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!authorized(req)) return NextResponse.json({ message: 'Invalid or missing SYNC_SECRET' }, { status: 401 });
  const slug = params.slug;
  if (!SLUGS.has(slug)) return NextResponse.json({ message: 'Unknown dashboard' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const dataSourceId = body?.dataSourceId as number | undefined;
  if (!dataSourceId) return NextResponse.json({ message: 'dataSourceId is required' }, { status: 400 });
  const link = await prisma.dashboardDataSourceLink.create({ data: { dashboard: slug, dataSourceId: BigInt(dataSourceId) } });
  return NextResponse.json({ id: link.id });
}

