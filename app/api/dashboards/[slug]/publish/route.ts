import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedEdit, unauthorizedJson } from '@/lib/authz';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!(await isAuthorizedEdit(req))) return NextResponse.json(unauthorizedJson(), { status: 401, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } });
  const slug = params.slug;
  // collect dataSourceIds linked to this dashboard
  const links = await prisma.dashboardDataSourceLink.findMany({ where: { dashboard: slug }, select: { dataSourceId: true } });
  const ids = links.map(l => l.dataSourceId);
  // publish widgets of this dashboard
  const w = await prisma.widget.updateMany({ where: { dashboard: slug, status: 'draft' as any }, data: { status: 'published' as any } });
  // publish data sources linked to this dashboard
  let dsCount = 0;
  if (ids.length > 0) {
    const r = await prisma.dataSource.updateMany({ where: { id: { in: ids }, status: 'draft' as any }, data: { status: 'published' as any } });
    dsCount = r.count;
  }
  // optional: layouts table if exists
  let layoutsCount = 0;
  try {
    const hasCamelTable: any[] = await prisma.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name='DashboardLayout' LIMIT 1");
    const hasSnakeTable: any[] = await prisma.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema='public' AND table_name='dashboard_layouts' LIMIT 1");
    if ((Array.isArray(hasCamelTable) && hasCamelTable.length > 0)) {
      const hasStatus: any[] = await prisma.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.columns WHERE table_schema='public' AND table_name='DashboardLayout' AND column_name='status' LIMIT 1");
      if (Array.isArray(hasStatus) && hasStatus.length > 0) {
        const c = await prisma.$executeRawUnsafe(`UPDATE "DashboardLayout" SET "status"='published' WHERE "dashboard"=$1 AND "status"='draft'`, slug as any);
        layoutsCount = typeof c === 'number' ? c : 0;
      }
    } else if ((Array.isArray(hasSnakeTable) && hasSnakeTable.length > 0)) {
      const hasStatus: any[] = await prisma.$queryRawUnsafe("SELECT 1 AS ok FROM information_schema.columns WHERE table_schema='public' AND table_name='dashboard_layouts' AND column_name='status' LIMIT 1");
      if (Array.isArray(hasStatus) && hasStatus.length > 0) {
        const c = await prisma.$executeRawUnsafe(`UPDATE "dashboard_layouts" SET status='published' WHERE dashboard=$1 AND status='draft'`, slug as any);
        layoutsCount = typeof c === 'number' ? c : 0;
      }
    }
  } catch {}
  return NextResponse.json(
    { ok: true, published: { widgets: w.count, dataSources: dsCount, layouts: layoutsCount } },
    { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } }
  );
}

