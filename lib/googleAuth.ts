import { google } from 'googleapis';

function normalizePrivateKey(raw?: string): string {
  if (!raw) throw new Error('GOOGLE_SHEETS_PRIVATE_KEY is missing');
  const trimmed = raw.trim();
  const hasEscapedNewlines = trimmed.includes('\\n') && !trimmed.includes('\n');
  const materialized = hasEscapedNewlines ? trimmed.replace(/\\n/g, '\n') : trimmed;
  try {
    if (!materialized.startsWith('-----BEGIN')) {
      const decoded = Buffer.from(materialized, 'base64').toString('utf8');
      if (decoded.startsWith('-----BEGIN')) return decoded.trim();
    }
  } catch {}
  return materialized;
}

export function getSheetsAuth() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL!;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY);
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return auth;
}

export { normalizePrivateKey };

