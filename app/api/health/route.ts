import { NextResponse } from 'next/server';
import { nowUtc, nowMsk } from '@/lib/time';

export async function GET() {
  return NextResponse.json({ status: 'ok', nowUtc: nowUtc(), nowMsk: nowMsk() });
}

