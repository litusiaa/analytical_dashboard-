import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const COOKIE_NAME = 'edit_session';

export function getTtlMinutes(): number {
  const v = Number(process.env.EDIT_SESSION_TTL_MIN || '60');
  return Number.isFinite(v) && v > 0 ? v : 60;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(ip: string | undefined, dashboard?: string) {
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + getTtlMinutes() * 60 * 1000);
  await prisma.edit_sessions.create({ data: { token_hash: tokenHash, dashboard: dashboard || null, expires_at: expires, ip: ip || null } });
  return { token, expiresAt: expires };
}

export async function getSession(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const tokenHash = hashToken(token);
  const row = await prisma.edit_sessions.findFirst({ where: { token_hash: tokenHash } });
  if (!row) return null;
  if (row.expires_at.getTime() < Date.now()) return null;
  return row;
}

export async function destroySession(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return; 
  const token = decodeURIComponent(match[1]);
  const tokenHash = hashToken(token);
  await prisma.edit_sessions.deleteMany({ where: { token_hash: tokenHash } });
}

export const cookieName = COOKIE_NAME;

