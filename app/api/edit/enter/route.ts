import { NextResponse } from 'next/server';
import { cookieName, createSession, getTtlMinutes } from '@/lib/editSession';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body?.code || '');
  const dashboard = body?.dashboard ? String(body.dashboard) : undefined;
  if (!process.env.EDIT_CODE || code !== process.env.EDIT_CODE) {
    return NextResponse.json({ error: 'Invalid edit code' }, { status: 401 });
  }
  const ip = req.headers.get('x-forwarded-for') || undefined;
  const { token, expiresAt } = await createSession(ip, dashboard);
  const res = NextResponse.json({ ok: true, ttlMin: getTtlMinutes(), expiresAt });
  res.headers.append('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${getTtlMinutes()*60}`);
  return res;
}

