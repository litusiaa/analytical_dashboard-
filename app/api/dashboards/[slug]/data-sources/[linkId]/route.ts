import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function canEdit(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /(?:^|;\s*)edit_mode=1(?:;|$)/.test(cookie);
}

export async function DELETE(req: Request, { params }: { params: { slug: string; linkId: string } }) {
  try {
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
      const widgetsClean = widgets.map((w) => ({ id: Number(w.id), title: w.title }));
      return NextResponse.json({ code: 'IN_USE', widgets: widgetsClean }, { status: 409, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    }

    await prisma.$transaction(async (tx) => {
    // hard delete link
    if (hard) {
      await tx.dashboardDataSourceLink.delete({ where: { id: linkId } });
    } else {
      // soft delete link: status/deletedAt handling depending on schema
      const cols: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink'");
      const hasStatus = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'status');
      const hasCamel = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deletedAt');
      const hasSnake = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deleted_at');
      const data: any = {};
      if (hasStatus) data.status = 'deleted';
      if (hasCamel) data.deletedAt = new Date();
      if (hasSnake) (data as any).deleted_at = new Date();
      if (Object.keys(data).length === 0) {
        // no soft-delete columns → hard delete the link
        await tx.dashboardDataSourceLink.delete({ where: { id: linkId } });
      } else {
        await tx.dashboardDataSourceLink.update({ where: { id: linkId }, data });
      }
    }

    if (!hard) {
      // cascade soft-delete widgets if forced
      if (widgets.length > 0 && force) {
        const wcols: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Widget'");
        const wHasStatus = Array.isArray(wcols) && wcols.some((c: any) => c.column_name === 'status');
        const wHasCamel = Array.isArray(wcols) && wcols.some((c: any) => c.column_name === 'deletedAt');
        const wHasSnake = Array.isArray(wcols) && wcols.some((c: any) => c.column_name === 'deleted_at');
        const wData: any = {};
        if (wHasStatus) wData.status = 'deleted';
        if (wHasCamel) wData.deletedAt = new Date();
        if (wHasSnake) (wData as any).deleted_at = new Date();
        if (Object.keys(wData).length === 0) {
          await tx.widget.deleteMany({ where: { dashboard: slug, dataSourceId: dsId } });
        } else {
          await tx.widget.updateMany({ where: { dashboard: slug, dataSourceId: dsId }, data: wData });
        }
      }

      // if no other links exist for this data source → soft delete the data source itself
      const remaining = await tx.dashboardDataSourceLink.count({ where: { dataSourceId: dsId, ...(hard ? {} : { NOT: { id: linkId } }) } });
      if (remaining === 0) {
        const dcols: any[] = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DataSource'");
        const dHasStatus = Array.isArray(dcols) && dcols.some((c: any) => c.column_name === 'status');
        const dHasCamel = Array.isArray(dcols) && dcols.some((c: any) => c.column_name === 'deletedAt');
        const dHasSnake = Array.isArray(dcols) && dcols.some((c: any) => c.column_name === 'deleted_at');
        const dData: any = {};
        if (dHasStatus) dData.status = 'deleted';
        if (dHasCamel) dData.deletedAt = new Date();
        if (dHasSnake) (dData as any).deleted_at = new Date();
        if (Object.keys(dData).length === 0) {
          await tx.dataSource.delete({ where: { id: dsId } });
        } else {
          await tx.dataSource.update({ where: { id: dsId }, data: dData });
        }
      }
    } else {
      // hard delete widgets of this dashboard only if forced hard? leave as is (widgets can remain unlinked)
    }
    });

    return NextResponse.json({ ok: true, id: Number(linkId) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

export async function PATCH(req: Request, { params }: { params: { slug: string; linkId: string } }) {
  try {
    if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    const slug = params.slug; // for future checks
    const linkId = BigInt(params.linkId);
    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'restore') return NextResponse.json({ message: 'Unsupported action' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    const cols: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink'");
    const hasStatus = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'status');
    const hasCamel = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deletedAt');
    const hasSnake = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'deleted_at');
    const data: any = {};
    if (hasStatus) data.status = 'draft';
    if (hasCamel) data.deletedAt = null;
    if (hasSnake) (data as any).deleted_at = null;
    if (Object.keys(data).length === 0) {
      // if no soft delete columns, nothing to restore (link must exist already)
      return NextResponse.json({ ok: true, id: Number(linkId) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    }
    await prisma.dashboardDataSourceLink.update({ where: { id: linkId }, data });
    return NextResponse.json({ ok: true, id: Number(linkId) }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

export async function PUT(req: Request, { params }: { params: { slug: string; linkId: string } }) {
  try {
    if (!canEdit(req)) return NextResponse.json({ error: 'Editing is disabled. Enable Edit dashboard.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    const linkId = BigInt(params.linkId);
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    if (action !== 'publish' && action !== 'unpublish') {
      return NextResponse.json({ message: 'Unsupported action' }, { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    }
    const cols: any[] = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardDataSourceLink' AND column_name IN ('status')");
    const hasStatus = Array.isArray(cols) && cols.some((c: any) => c.column_name === 'status');
    if (!hasStatus) {
      // If no status column, best-effort no-op success
      const link = await prisma.dashboardDataSourceLink.findUnique({ where: { id: linkId } });
      return NextResponse.json({ ok: true, id: Number(linkId), status: null, dataSourceId: link ? Number(link.dataSourceId) : undefined }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
    }
    const nextStatus = action === 'publish' ? 'published' : 'draft';
    const updated = await prisma.dashboardDataSourceLink.update({ where: { id: linkId }, data: { status: nextStatus as any } as any });
    return NextResponse.json({ ok: true, id: Number(linkId), status: nextStatus }, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  }
}

