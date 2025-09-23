import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function DELETE(req: Request, { params }: { params: { slug: string; linkId: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const slug = params.slug;
  const linkId = BigInt(params.linkId);
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';
  const hard = url.searchParams.get('hard') === 'true';

  const link = await prisma.dashboardDataSourceLink.findUnique({ where: { id: linkId } });
  if (!link || link.dashboard !== slug) return NextResponse.json({ message: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const dsId = link.dataSourceId;

  // widgets of this dashboard using this data source
  const widgets = await prisma.widget.findMany({ where: { dashboard: slug, dataSourceId: dsId }, select: { id: true, title: true } });
  if (!hard && widgets.length > 0 && !force) {
    return NextResponse.json({ code: 'IN_USE', widgets }, { status: 409, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }

  await prisma.$transaction(async (tx) => {
    // hard delete link
    if (hard) {
      await tx.dashboardDataSourceLink.delete({ where: { id: linkId } });
    } else {
      // soft delete link: status/deletedAt handling depending on schema
      const cols: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink' AND column_name IN ('status','deletedAt','deleted_at')");
      const hasStatus = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'status');
      const hasCamel = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deletedAt');
      const data: any = { status: 'deleted' };
      if (!hasStatus) delete data.status;
      if (hasCamel) data.deletedAt = new Date(); else (data as any).deleted_at = new Date();
      await tx.dashboardDataSourceLink.update({ where: { id: linkId }, data });
    }

    if (!hard) {
      // cascade soft-delete widgets if forced
      if (widgets.length > 0 && force) {
        const wcols: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget' AND column_name IN ('status','deletedAt','deleted_at')");
        const wHasStatus = Array.isArray(wcols) && wcols.some((c: any) => c.column_name === 'status');
        const wHasCamel = Array.isArray(wcols) && wcols.some((c: any) => c.column_name === 'deletedAt');
        const wData: any = { status: 'deleted' };
        if (!wHasStatus) delete wData.status;
        if (wHasCamel) wData.deletedAt = new Date(); else (wData as any).deleted_at = new Date();
        await tx.widget.updateMany({ where: { dashboard: slug, dataSourceId: dsId }, data: wData });
      }

      // if no other links exist for this data source → soft delete the data source itself
      const remaining = await tx.dashboardDataSourceLink.count({ where: { dataSourceId: dsId, ...(hard ? {} : { NOT: { id: linkId } }) } });
      if (remaining === 0) {
        const dcols: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource' AND column_name IN ('status','deletedAt','deleted_at')");
        const dHasStatus = Array.isArray(dcols) && dcols.some((c: any) => c.column_name === 'status');
        const dHasCamel = Array.isArray(dcols) && dcols.some((c: any) => c.column_name === 'deletedAt');
        const dData: any = { status: 'deleted' };
        if (!dHasStatus) delete dData.status;
        if (dHasCamel) dData.deletedAt = new Date(); else (dData as any).deleted_at = new Date();
        await tx.dataSource.update({ where: { id: dsId }, data: dData });
      }
    } else {
      // hard delete widgets of this dashboard only if forced hard? leave as is (widgets can remain unlinked)
    }
  });

  return NextResponse.json({ ok: true, id: Number(linkId) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

export async function PATCH(req: Request, { params }: { params: { slug: string; linkId: string } }) {
  if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const slug = params.slug; // for future checks
  const linkId = BigInt(params.linkId);
  const body = await req.json().catch(() => ({}));
  if (body?.action !== 'restore') return NextResponse.json({ message: 'Unsupported action' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const cols: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink' AND column_name IN ('status','deletedAt','deleted_at')");
  const hasStatus = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'status');
  const hasCamel = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deletedAt');
  const data: any = { status: 'draft' };
  if (!hasStatus) delete data.status;
  if (hasCamel) data.deletedAt = null; else (data as any).deleted_at = null;
  await prisma.dashboardDataSourceLink.update({ where: { id: linkId }, data });
  return NextResponse.json({ ok: true, id: Number(linkId) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.substring('Bearer '.length) : undefined;
  const secret = token || new URL(req.url).searchParams.get('secret');
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function DELETE(req: Request, { params }: { params: { linkId: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401 });
  await prisma.dashboardDataSourceLink.delete({ where: { id: BigInt(params.linkId) } });
  return NextResponse.json({ ok: true });
}

