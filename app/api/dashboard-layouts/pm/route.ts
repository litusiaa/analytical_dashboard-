import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const layout = body?.layout ?? {};
  const item = await prisma.dashboard_layouts.upsert({
    where: { dashboard_slug: 'pm' },
    create: { dashboard_slug: 'pm', layout, updated_at: new Date() },
    update: { layout, updated_at: new Date() },
  });
  return NextResponse.json({ ok: true, id: item.id });
}

