import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  const slug = params.slug;
  await prisma.widget.updateMany({ where: { dashboard: slug, status: 'draft' }, data: { status: 'published', last_edited_at: new Date() } });
  await prisma.dataSource.updateMany({ where: { status: 'draft' }, data: { status: 'published', last_edited_at: new Date() } });
  return NextResponse.json({ ok: true });
}

