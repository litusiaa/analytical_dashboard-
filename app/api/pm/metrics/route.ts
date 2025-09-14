import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPmMetrics } from '@/lib/metrics';

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

    const data = await getPmMetrics(parsed.from, parsed.to, parsed.ownerName);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Bad Request' }, { status: 400 });
  }
}

