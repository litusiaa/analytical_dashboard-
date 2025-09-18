import { NextResponse } from 'next/server';
import { parseSpreadsheetIdFromUrl } from '@/lib/googleSheets';
import { google } from 'googleapis';
import { getSheetsAuth } from '@/lib/googleAuth';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sheetUrl = url.searchParams.get('url');
    if (!sheetUrl) return NextResponse.json({ message: 'url is required' }, { status: 400 });
    const spreadsheetId = parseSpreadsheetIdFromUrl(sheetUrl);
    if (!spreadsheetId) return NextResponse.json({ message: 'Invalid Google Sheets URL' }, { status: 400 });

    const auth = getSheetsAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });

    const title = meta.data.properties?.title || 'Spreadsheet';
    const sheetList = (meta.data.sheets || []).map((s) => ({
      title: s.properties?.title || 'Лист',
      rangeGuess: `${s.properties?.title || 'Лист'}!A1:Z`,
    }));

    return NextResponse.json({ title, spreadsheetId, sheets: sheetList });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('invalid format') || msg.includes('DECODER')) {
      return NextResponse.json({ message: 'Неверный формат приватного ключа. Проверьте GOOGLE_SHEETS_PRIVATE_KEY в ENV.' }, { status: 500 });
    }
    if (msg.includes('403') || msg.includes('PERMISSION')) {
      return NextResponse.json({ message: `Нет доступа. Добавьте редактора: ${process.env.GOOGLE_SHEETS_CLIENT_EMAIL}` }, { status: 403 });
    }
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

