import { prisma } from '@/lib/prisma';
import { KEY_STAGES } from '@/lib/mapping';
import { parseYmd } from '@/lib/time';

export type Period = { from: string; to: string };

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10; // 1 decimal place
}

export async function recomputePmMetricsCache(from: string, to: string, ownerId: bigint) {
  const fromDate = parseYmd(from);
  const toDate = parseYmd(to);

  // Signed: last entry from Sales A → Integration within period
  const signedDeals = await prisma.$queryRawUnsafe<Array<{ deal_id: bigint }>>(`
    SELECT DISTINCT ON (e.deal_id) e.deal_id
    FROM pd_stage_events e
    JOIN pd_deals d ON d.id = e.deal_id
    WHERE e.stage_id IN (
      SELECT id FROM pd_stages WHERE name = $1
    )
      AND d.owner_id = $2
      AND e.entered_at::date BETWEEN $3::date AND $4::date
    ORDER BY e.deal_id, e.entered_at DESC
  `, KEY_STAGES.INTEGRATION, ownerId, fromDate, toDate);

  const signedIds = signedDeals.map((r) => r.deal_id);
  const signedCount = signedIds.length;

  // Launched: subset where current stage = Active
  const launchedCount = signedCount
    ? (await prisma.pd_deals.count({ where: { id: { in: signedIds }, stage_id: { in: (await stageIdsByName([KEY_STAGES.ACTIVE])) } } }))
    : 0;

  // Missed deadline: expected_close_date passed but not Active yet
  const missedCount = await prisma.pd_deals.count({
    where: {
      id: { in: signedIds },
      expected_close_date: { lt: new Date() },
      OR: [
        { stage_id: { notIn: await stageIdsByName([KEY_STAGES.ACTIVE]) } },
        { stage_id: null },
      ],
    },
  });

  // Avg Integration → Pilot
  const avgIntegrationToPilot = await averageDaysBetweenStages(KEY_STAGES.INTEGRATION, KEY_STAGES.PILOT, signedIds);

  const launchPct = pct(launchedCount, signedCount);
  const missedPct = pct(missedCount, signedCount);

  await prisma.pm_metrics_cache.create({
    data: {
      owner_id: ownerId,
      from_date: fromDate,
      to_date: toDate,
      signed_count: signedCount,
      launched_count: launchedCount,
      launch_pct: launchPct as unknown as any,
      missed_deadline_count: missedCount,
      missed_deadline_pct: missedPct as unknown as any,
      avg_integration_to_pilot: avgIntegrationToPilot as unknown as any,
      computed_at: new Date(),
    },
  });
}

async function stageIdsByName(names: string[]): Promise<bigint[]> {
  const stages = await prisma.pd_stages.findMany({ where: { name: { in: names } }, select: { id: true } });
  return stages.map((s) => s.id);
}

async function averageDaysBetweenStages(fromName: string, toName: string, dealIds: bigint[]): Promise<number | null> {
  if (!dealIds.length) return null;
  const fromIds = await stageIdsByName([fromName]);
  const toIds = await stageIdsByName([toName]);
  if (!fromIds.length || !toIds.length) return null;

  const rows = await prisma.$queryRawUnsafe<Array<{ deal_id: bigint; from_at: Date; to_at: Date }>>(`
    WITH f AS (
      SELECT deal_id, MIN(entered_at) AS from_at
      FROM pd_stage_events
      WHERE deal_id = ANY($1) AND stage_id = ANY($2)
      GROUP BY deal_id
    ), t AS (
      SELECT deal_id, MIN(entered_at) AS to_at
      FROM pd_stage_events
      WHERE deal_id = ANY($1) AND stage_id = ANY($3)
      GROUP BY deal_id
    )
    SELECT f.deal_id, f.from_at, t.to_at
    FROM f JOIN t USING (deal_id)
    WHERE t.to_at >= f.from_at
  `, dealIds, fromIds, toIds);

  if (!rows.length) return null;
  const days = rows.map((r) => (r.to_at.getTime() - r.from_at.getTime()) / (1000 * 60 * 60 * 24));
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  return Math.round(avg * 10) / 10;
}

export async function getPmMetrics(from: string, to: string, ownerName: string) {
  // Prefer cached row; if missing, compute on the fly for owner
  const owner = await prisma.pd_users.findFirst({ where: { name: ownerName }, select: { id: true } });
  const ownerId = owner?.id ?? BigInt(0);
  const item = await prisma.pm_metrics_cache.findFirst({
    where: { owner_id: ownerId, from_date: parseYmd(from), to_date: parseYmd(to) },
    orderBy: { computed_at: 'desc' },
  });

  if (!item) {
    await recomputePmMetricsCache(from, to, ownerId);
  }

  const row = await prisma.pm_metrics_cache.findFirst({
    where: { owner_id: ownerId, from_date: parseYmd(from), to_date: parseYmd(to) },
    orderBy: { computed_at: 'desc' },
  });

  // Minimal trend: monthly breakdown by end-of-month
  const trend = await prisma.$queryRawUnsafe<Array<{ month: string; signed: number; launched: number }>>(`
    SELECT to_char(d, 'YYYY-MM') AS month,
      COALESCE((SELECT signed_count FROM pm_metrics_cache c WHERE c.owner_id=$1 AND c.from_date=date_trunc('month', d)::date AND c.to_date=(date_trunc('month', d) + interval '1 month - 1 day')::date ORDER BY computed_at DESC LIMIT 1), 0) AS signed,
      COALESCE((SELECT launched_count FROM pm_metrics_cache c WHERE c.owner_id=$1 AND c.from_date=date_trunc('month', d)::date AND c.to_date=(date_trunc('month', d) + interval '1 month - 1 day')::date ORDER BY computed_at DESC LIMIT 1), 0) AS launched
    FROM generate_series(date_trunc('month', $2::date), date_trunc('month', $3::date), interval '1 month') AS d
  `, ownerId, parseYmd(from), parseYmd(to));

  const launched = row?.launched_count ?? 0;
  const signed = row?.signed_count ?? 0;

  return {
    launchPct: Number(row?.launch_pct ?? (pct(launched, signed))),
    signedCount: signed,
    launchedCount: launched,
    missedPct: Number(row?.missed_deadline_pct ?? 0),
    missedCount: row?.missed_deadline_count ?? 0,
    avgIntegrationToPilotDays: row?.avg_integration_to_pilot ? Number(row.avg_integration_to_pilot) : null,
    trend: trend.map((t) => ({ month: t.month, launchPct: pct(t.launched, t.signed), signed: t.signed, launched: t.launched })),
  };
}

export async function getOverdue(from: string, to: string, ownerName: string) {
  // overdue_days = today_MSK - plan_date if not Active
  const owner = await prisma.pd_users.findFirst({ where: { name: ownerName }, select: { id: true } });
  const activeIds = await prisma.pd_stages.findMany({ where: { name: 'Active' }, select: { id: true } });
  const activeId = activeIds[0]?.id ?? BigInt(-1);
  const rows = await prisma.$queryRawUnsafe<Array<any>>(`
    SELECT d.id, d.title, d.org_name, d.owner_name, d.expected_close_date, d.pd_link,
      GREATEST(0, (CURRENT_DATE - COALESCE(d.expected_close_date, CURRENT_DATE))) AS overdue_days
    FROM pd_deals d
    WHERE d.owner_id = $1 AND (d.stage_id IS DISTINCT FROM $2)
      AND (d.expected_close_date IS NOT NULL)
      AND (d.update_time::date BETWEEN $3::date AND $4::date)
    ORDER BY overdue_days DESC NULLS LAST
  `, owner?.id ?? BigInt(0), activeId, parseYmd(from), parseYmd(to));
  return rows.map((r) => ({ id: String(r.id), title: r.title, orgName: r.org_name, ownerName: r.owner_name, planDate: r.expected_close_date, overdueDays: Number(r.overdue_days), pdLink: r.pd_link }));
}

