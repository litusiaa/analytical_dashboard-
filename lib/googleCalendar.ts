import { prisma } from '@/lib/prisma';

function env(name: string, def?: string): string {
  const v = process.env[name] || def;
  if (!v) throw new Error(`Missing ENV ${name}`);
  return v;
}

function envAny(names: string[], def?: string): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  if (def) return def;
  throw new Error(`Missing ENV ${names.join(' or ')}`);
}

const TZ = env('APP_TIMEZONE', 'Europe/Moscow');

async function ensureTable() {
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS google_oauth_tokens (
      id BIGSERIAL PRIMARY KEY,
      provider TEXT UNIQUE,
      refresh_token TEXT,
      access_token TEXT,
      expiry_date TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )`);
  } catch {}
}

export async function getAccessToken(): Promise<string> {
  const provider = 'google';
  const refreshToken = envAny(['GOOGLE_CALENDAR_REFRESH_TOKEN','GOOGLE_OAUTH_REFRESH_TOKEN']);
  await ensureTable();
  // Ensure row exists and refresh token is stored
  let row: any = null;
  try {
    const rs: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM google_oauth_tokens WHERE provider=$1 LIMIT 1`, provider) as any[];
    row = rs?.[0] ?? null;
  } catch {}
  if (!row) {
    try { await prisma.$executeRawUnsafe(`INSERT INTO google_oauth_tokens (provider, refresh_token, updated_at) VALUES ($1,$2,NOW())`, provider, refreshToken); } catch {}
  } else if (!row.refresh_token) {
    try { await prisma.$executeRawUnsafe(`UPDATE google_oauth_tokens SET refresh_token=$2, updated_at=NOW() WHERE provider=$1`, provider, refreshToken); } catch {}
  }
  try {
    const rs: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM google_oauth_tokens WHERE provider=$1 LIMIT 1`, provider) as any[];
    row = rs?.[0] ?? null;
  } catch {}
  const now = Date.now();
  if (row?.access_token && row?.expiry_date && new Date(row.expiry_date).getTime() - 60_000 > now) {
    return String(row.access_token);
  }
  const client_id = envAny(['GOOGLE_CALENDAR_CLIENT_ID','GOOGLE_OAUTH_CLIENT_ID']);
  const client_secret = envAny(['GOOGLE_CALENDAR_CLIENT_SECRET','GOOGLE_OAUTH_CLIENT_SECRET']);
  const refresh_token = row?.refresh_token || refreshToken;
  const params = new URLSearchParams({
    client_id,
    client_secret,
    refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(), cache: 'no-store' as any });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error('Failed to refresh Google access token');
  }
  const expiryMs = json.expires_in ? Date.now() + Number(json.expires_in) * 1000 : (Date.now() + 50 * 60_000);
  try {
    const rs: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM google_oauth_tokens WHERE provider=$1 LIMIT 1`, provider) as any[];
    if (rs && rs.length) {
      await prisma.$executeRawUnsafe(`UPDATE google_oauth_tokens SET access_token=$2, expiry_date=$3, updated_at=NOW() WHERE provider=$1`, provider, json.access_token, new Date(expiryMs));
    } else {
      await prisma.$executeRawUnsafe(`INSERT INTO google_oauth_tokens (provider, refresh_token, access_token, expiry_date, updated_at) VALUES ($1,$2,$3,$4,NOW())`, provider, refresh_token, json.access_token, new Date(expiryMs));
    }
  } catch {}
  return String(json.access_token);
}

function toRfc3339Utc(localIso: string): string {
  // localIso is ISO with offset (or YYYY-MM-DD). We normalize via Date.
  const d = new Date(localIso);
  return d.toISOString();
}

export async function listCalendars(): Promise<any[]> {
  const token = await getAccessToken();
  const u = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  u.searchParams.set('minAccessRole', 'freeBusyReader');
  const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } as any, cache: 'no-store' as any });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Нет доступа к календарям. Дайте доступ аккаунту Виолетты или разрешите доменный просмотр.');
    (err as any).status = 403; throw err;
  }
  if (!res.ok) throw new Error('CalendarList error');
  const items = Array.isArray(j.items) ? j.items : [];
  return items.filter((x: any) => ['owner','writer','reader','freeBusyReader'].includes(String(x.accessRole||'')));
}

export async function listEvents(calendarIds: string[], timeMinLocal: string, timeMaxLocal: string): Promise<{ items: any[]; errors: any[] }> {
  const token = await getAccessToken();
  const timeMin = toRfc3339Utc(timeMinLocal);
  const timeMax = toRfc3339Utc(timeMaxLocal);
  const ids = (calendarIds && calendarIds.length) ? calendarIds : ['primary'];
  const all: any[] = []; const errors: any[] = [];
  for (const id of ids) {
    const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`);
    u.searchParams.set('timeMin', timeMin);
    u.searchParams.set('timeMax', timeMax);
    u.searchParams.set('singleEvents', 'true');
    u.searchParams.set('orderBy', 'startTime');
    const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } as any, cache: 'no-store' as any });
    const j = await res.json().catch(() => ({}));
    if (res.status === 403) { errors.push({ calendarId: id, message: 'Нет доступа к календарю' }); continue; }
    if (!res.ok) { errors.push({ calendarId: id, message: 'Ошибка' }); continue; }
    const items = Array.isArray(j.items) ? j.items : [];
    for (const ev of items) {
      all.push({
        calendarId: id,
        owner: j.summary || id,
        start: ev.start?.dateTime || ev.start?.date,
        end: ev.end?.dateTime || ev.end?.date,
        summary: ev.summary || '',
        organizer: ev.organizer?.email || null,
        attendees: (ev.attendees||[]).map((a: any)=> a.email),
        hangoutLink: ev.hangoutLink || null,
        location: ev.location || null,
        status: ev.status || 'confirmed',
      });
    }
  }
  return { items: all, errors };
}

export { TZ };


