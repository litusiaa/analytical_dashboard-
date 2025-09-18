import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { parseSpreadsheetIdFromUrl } from '@/lib/googleSheets';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sheetUrl = url.searchParams.get('url');
    const sheetTitle = url.searchParams.get('sheet');
    const range = url.searchParams.get('range') || 'A1:Z';
    if (!sheetUrl || !sheetTitle) return NextResponse.json({ message: 'url and sheet are required' }, { status: 400 });
    const spreadsheetId = parseSpreadsheetIdFromUrl(sheetUrl);
    if (!spreadsheetId) return NextResponse.json({ message: 'Invalid Google Sheets URL' }, { status: 400 });

    const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const pkRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    if (!email || !pkRaw) return NextResponse.json({ message: 'Google credentials missing' }, { status: 500 });
    const auth = new JWT({ email, key: pkRaw.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetTitle}!${range}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const all = (res.data.values as any[][]) || [];
    const rows = all.slice(0, 5);
    return NextResponse.json({ rows });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = msg.includes('403') ? 403 : 500;
    return NextResponse.json({ message: msg }, { status });
  }
}

