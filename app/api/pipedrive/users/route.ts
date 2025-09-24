import { NextResponse } from 'next/server';
import { fetchUsers } from '@/lib/pipedrive';

export async function GET() {
  try {
    const users = await fetchUsers();
    return NextResponse.json({ items: users }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}


