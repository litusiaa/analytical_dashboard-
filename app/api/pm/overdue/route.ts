import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOverdue } from '@/lib/metrics';

const schema = z.object({
  from: z.string(),
  to: z.string(),
  ownerName: z.string().default('Евгения Попова'),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = schema.parse({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      ownerName: url.searchParams.get('ownerName') || 'Евгения Попова',
    });
    const rows = await getOverdue(parsed.from, parsed.to, parsed.ownerName);
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Bad Request' }, { status: 400 });
  }
}

