import { NextResponse } from 'next/server';

const slugs = ['pm','ds','csm','finance','partner','sales'];

export async function GET() {
  return NextResponse.json({ slugs });
}

