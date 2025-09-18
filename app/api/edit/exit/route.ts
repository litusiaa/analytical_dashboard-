import { NextResponse } from 'next/server';
import { cookieName, destroySession } from '@/lib/editSession';

export async function POST(req: Request) {
  await destroySession(req);
  const res = NextResponse.json({ ok: true });
  res.headers.append('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
  return res;
}

