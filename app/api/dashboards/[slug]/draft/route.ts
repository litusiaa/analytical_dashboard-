import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  // No-op for now; widgets are already created as draft. This endpoint exists for UI button semantics.
  return NextResponse.json({ ok: true });
}

