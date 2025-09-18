import { google } from 'googleapis';

function normalizePrivateKey(raw?: string): string {
  if (!raw) throw new Error('GOOGLE_SHEETS_PRIVATE_KEY is missing');
  let v = raw.trim();
  // strip wrapping quotes if user pasted with quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  // materialize escaped newlines first
  if (v.includes('\\n')) {
    v = v.replace(/\\n/g, '\n');
  }
  // normalize CRLF to LF
  v = v.replace(/\r\n/g, '\n');
  try {
    if (!v.startsWith('-----BEGIN')) {
      const decoded = Buffer.from(v, 'base64').toString('utf8');
      if (decoded.startsWith('-----BEGIN')) v = decoded;
    }
  } catch {}
  v = v.trim();
  // final guard: must contain header/footer
  if (!v.includes('-----BEGIN') || !v.includes('-----END')) {
    throw new Error('GOOGLE_SHEETS_PRIVATE_KEY has invalid format');
  }
  return v;
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

