import { NextResponse } from 'next/server';

const COOKIE_NAME = 'edit_mode';
const TTL_MIN = Number(process.env.EDIT_SESSION_TTL_MIN || '60');

export async function POST() {
  const res = NextResponse.json({ ok: true, ttlMin: TTL_MIN });
  res.headers.append('Set-Cookie', `${COOKIE_NAME}=1; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${TTL_MIN * 60}`);
  return res;
}

