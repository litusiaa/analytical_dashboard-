import { NextResponse } from 'next/server';
import { parseSpreadsheetIdFromUrl } from '@/lib/googleSheets';
import { google } from 'googleapis';
import { getSheetsAuth } from '@/lib/googleAuth';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sheetUrl = url.searchParams.get('url');
    const sheetTitle = url.searchParams.get('sheet');
    const range = url.searchParams.get('range') || 'A1:Z';
    if (!sheetUrl || !sheetTitle) return NextResponse.json({ message: 'url and sheet are required' }, { status: 400 });
    const spreadsheetId = parseSpreadsheetIdFromUrl(sheetUrl);
    if (!spreadsheetId) return NextResponse.json({ message: 'Invalid Google Sheets URL' }, { status: 400 });

    const auth = getSheetsAuth();
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
    if (msg.includes('403') || msg.includes('PERMISSION')) {
      return NextResponse.json({ message: `Нет доступа. Добавьте редактора: ${process.env.GOOGLE_SHEETS_CLIENT_EMAIL}` }, { status: 403 });
    }
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

