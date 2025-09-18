import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  const slug = params.slug;
  // Delete draft widgets for this dashboard; data sources left intact in MVP
  await prisma.widget.deleteMany({ where: { dashboard: slug, status: 'draft' } });
  return NextResponse.json({ ok: true });
}

