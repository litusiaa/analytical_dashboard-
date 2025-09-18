import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEditMode } from '@/lib/requireEditMode';

export async function GET(req: Request) {
  try {
    await requireEditMode(req);
    const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
      'SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10'
    );
    return NextResponse.json({ applied });
  } catch (e: any) {
    const status = e?.statusCode || 500;
    return NextResponse.json({ error: String(e?.message || e) }, { status });
  }
}


