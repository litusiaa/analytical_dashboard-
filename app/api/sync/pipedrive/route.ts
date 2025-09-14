import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchDealsByOwner, fetchPipelines, fetchStages, fetchUsers, fetchStageHistory } from '@/lib/pipedrive';
import { KEY_STAGES } from '@/lib/mapping';
import { recomputePmMetricsCache } from '@/lib/metrics';

function authorized(req: Request): boolean {
  const url = new URL(req.url);
  const bearer = req.headers.get('authorization');
  const token = bearer?.startsWith('Bearer ')
    ? bearer.substring('Bearer '.length)
    : undefined;
  let secret = url.searchParams.get('secret') || token;
  // Allow Vercel Cron placeholder to resolve to ENV at runtime
  if (secret === '__SYNC_SECRET__') {
    secret = process.env.SYNC_SECRET;
  }
  return Boolean(secret && process.env.SYNC_SECRET && secret === process.env.SYNC_SECRET);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ message: 'Invalid or missing SYNC_SECRET' }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') || 'inc';

  const startedAt = new Date();
  let status: 'ok' | 'error' = 'ok';
  const info: Record<string, any> = { mode };

  try {
    // 1. Sync directories
    const [users, pipelines, stages] = await Promise.all([
      fetchUsers(),
      fetchPipelines(),
      fetchStages(),
    ]);

    await prisma.$transaction([
      prisma.$executeRaw`TRUNCATE TABLE pd_users`,
      prisma.$executeRaw`TRUNCATE TABLE pd_pipelines`,
      prisma.$executeRaw`TRUNCATE TABLE pd_stages`,
    ]);

    await prisma.$transaction([
      prisma.pd_users.createMany({ data: users.map((u) => ({ id: BigInt(u.id), name: u.name, email: u.email ?? null, updated_at: new Date(), raw: u as any })) }),
      prisma.pd_pipelines.createMany({ data: pipelines.map((p) => ({ id: BigInt(p.id), name: p.name, updated_at: new Date(), raw: p as any })) }),
      prisma.pd_stages.createMany({ data: stages.map((s) => ({ id: BigInt(s.id), pipeline_id: BigInt(s.pipeline_id), name: s.name, order_no: s.order_nr ?? null, updated_at: new Date(), raw: s as any })) }),
    ]);

    // 2. Deals for owner
    const ownerName = 'Евгения Попова';
    const deals = await fetchDealsByOwner(ownerName);

    // Upsert deals
    for (const d of deals) {
      await prisma.pd_deals.upsert({
        where: { id: BigInt(d.id) },
        create: {
          id: BigInt(d.id),
          title: d.title,
          org_id: d.org_id ? BigInt(d.org_id) : null,
          org_name: d.org_name ?? null,
          owner_id: d.owner_id ? BigInt(d.owner_id) : null,
          owner_name: d.owner_name ?? null,
          pipeline_id: d.pipeline_id ? BigInt(d.pipeline_id) : null,
          stage_id: d.stage_id ? BigInt(d.stage_id) : null,
          status: d.status,
          add_time: d.add_time ? new Date(d.add_time) : null,
          update_time: d.update_time ? new Date(d.update_time) : null,
          won_time: d.won_time ? new Date(d.won_time) : null,
          expected_close_date: d.expected_close_date ? new Date(d.expected_close_date) : null,
          pd_link: `https://app.pipedrive.com/deal/${d.id}`,
          raw: d as any,
          updated_at: new Date(),
        },
        update: {
          title: d.title,
          org_id: d.org_id ? BigInt(d.org_id) : null,
          org_name: d.org_name ?? null,
          owner_id: d.owner_id ? BigInt(d.owner_id) : null,
          owner_name: d.owner_name ?? null,
          pipeline_id: d.pipeline_id ? BigInt(d.pipeline_id) : null,
          stage_id: d.stage_id ? BigInt(d.stage_id) : null,
          status: d.status,
          add_time: d.add_time ? new Date(d.add_time) : null,
          update_time: d.update_time ? new Date(d.update_time) : null,
          won_time: d.won_time ? new Date(d.won_time) : null,
          expected_close_date: d.expected_close_date ? new Date(d.expected_close_date) : null,
          raw: d as any,
          updated_at: new Date(),
        },
      });

      // 3. Stage history for selected stages
      const hist = await fetchStageHistory(d.id);
      const interested = new Set<string>([KEY_STAGES.INTEGRATION, KEY_STAGES.PILOT, KEY_STAGES.ACTIVE]);

      for (const h of hist) {
        const stage = stages.find((s) => s.id === h.stage_id);
        if (!stage || !interested.has(stage.name)) continue;
        await prisma.pd_stage_events.create({
          data: {
            deal_id: BigInt(d.id),
            pipeline_id: h.pipeline_id ? BigInt(h.pipeline_id) : null,
            stage_id: BigInt(h.stage_id),
            entered_at: new Date(h.time),
            source: 'flow_api',
            snapshot_expected_close_date: h.expected_close_date ? new Date(h.expected_close_date) : null,
            meta: null,
          },
        });
      }
    }

    // 4. Recompute cache for 2025-01-01..today (MSK)
    const from = '2025-01-01';
    const to = new Date().toISOString().slice(0, 10);
    const owner = await prisma.pd_users.findFirst({ where: { name: ownerName } });
    if (owner) {
      await prisma.pm_metrics_cache.deleteMany({ where: { owner_id: owner.id, from_date: new Date(from), to_date: new Date(to) } });
      await recomputePmMetricsCache(from, to, owner.id);
    }

  } catch (e: any) {
    status = 'error';
    info.error = true;
  } finally {
    await prisma.sync_logs.create({ data: { source: 'pipedrive', started_at: startedAt, finished_at: new Date(), status, info: info as any } });
  }

  return NextResponse.json({ status: 'ok' });
}

