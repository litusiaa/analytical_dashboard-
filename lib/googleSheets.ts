import { JWT } from 'google-auth-library';
import { google } from 'googleapis';

function getJwtClient() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const pkRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !pkRaw) throw new Error('Google Sheets credentials are not configured');
  const privateKey = pkRaw.replace(/\\n/g, '\n');
  const jwt = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return jwt;
}

export function parseSpreadsheetIdFromUrl(url: string): string | null {
  try {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function readValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const auth = getJwtClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return (res.data.values as string[][]) || [];
}

