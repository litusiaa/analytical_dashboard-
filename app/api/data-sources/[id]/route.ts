import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = BigInt(params.id);
    const cols: any[] = await prisma.$queryRawUnsafe(
      "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name='DataSourceSheet' LIMIT 1"
    );
    const ds = await prisma.dataSource.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, spreadsheetId: true, defaultRange: true, status: true, updatedAt: true },
    });
    if (!ds) return NextResponse.json({ message: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    let sheets: any[] = [];
    if (Array.isArray(cols) && cols.length > 0) {
      sheets = await prisma.dataSourceSheet.findMany({ where: { dataSourceId: id }, select: { title: true, range: true } });
    }
    return NextResponse.json({ ...ds, sheets }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const id = BigInt(params.id);
  const body = await req.json().catch(() => ({}));
  const action = body?.action || 'restore';
  if (action !== 'restore') return NextResponse.json({ message: 'Unsupported action' }, { status: 400 });
  const col2: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource' AND column_name IN ('deletedAt','deleted_at','status')");
  const hasCamel2 = Array.isArray(col2) && col2.some((c: any) => c.column_name === 'deletedAt');
  const hasStatus = Array.isArray(col2) && col2.some((c: any) => c.column_name === 'status');
  const data2: any = { status: 'draft' };
  if (!hasStatus) delete data2.status;
  if (hasCamel2) data2.deletedAt = null; else (data2 as any).deleted_at = null;
  await prisma.dataSource.update({ where: { id }, data: data2 });
  return NextResponse.json({ ok: true, id: Number(id) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401 });
  const id = BigInt(params.id);
  const url = new URL(req.url);
  const cascade = url.searchParams.get('cascade') === 'true' || url.searchParams.get('force') === 'true';
  const hard = url.searchParams.get('hard') === 'true';

  const widgets = await prisma.widget.findMany({ where: { dataSourceId: id }, select: { id: true, title: true } });
  if (!hard && widgets.length > 0 && !cascade) {
    return NextResponse.json({ code: 'IN_USE', widgets }, { status: 409, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }

  await prisma.$transaction(async (tx) => {
    if (hard) {
      // hard delete widgets, sheets, link records, and datasource
      await tx.widget.deleteMany({ where: { dataSourceId: id } });
      const hasSheets: any[] = await tx.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name='DataSourceSheet' LIMIT 1");
      if (Array.isArray(hasSheets) && hasSheets.length > 0) {
        await tx.dataSourceSheet.deleteMany({ where: { dataSourceId: id } });
      }
      await tx.dashboardDataSourceLink.deleteMany({ where: { dataSourceId: id } });
      await tx.dataSource.delete({ where: { id } });
      return;
    }
    if (widgets.length > 0 && cascade) {
      const col: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name IN ('deletedAt','deleted_at','status')");
      const hasCamel = Array.isArray(col) && col.some((c: any) => c.column_name === 'deletedAt');
      const hasStatusW = Array.isArray(col) && col.some((c: any) => c.column_name === 'status');
      const data: any = { status: 'deleted' };
      if (!hasStatusW) delete data.status;
      if (hasCamel) data.deletedAt = new Date(); else (data as any).deleted_at = new Date();
      await tx.widget.updateMany({ where: { dataSourceId: id }, data });
    }
    const col2: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource' AND column_name IN ('deletedAt','deleted_at','status')");
    const hasCamel2 = Array.isArray(col2) && col2.some((c: any) => c.column_name === 'deletedAt');
    const hasStatus = Array.isArray(col2) && col2.some((c: any) => c.column_name === 'status');
    const data2: any = { status: 'deleted' };
    if (!hasStatus) delete data2.status;
    if (hasCamel2) data2.deletedAt = new Date(); else (data2 as any).deleted_at = new Date();
    await tx.dataSource.update({ where: { id }, data: data2 });
  });
  return NextResponse.json({ ok: true, id: Number(id) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

