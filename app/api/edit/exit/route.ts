import { NextResponse } from 'next/server';
const COOKIE_NAME = 'edit_mode';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
  return res;
}

