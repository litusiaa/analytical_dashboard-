import { KPI } from '@/components/KPI';
import { ChartLine } from '@/components/ChartLine';
import { TableOverdue } from '@/components/TableOverdue';
import { Card } from '@/components/Card';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
}

export default async function PMPage() {
  const ownerName = 'Евгения Попова';
  const from = '2025-01-01';
  const to = new Date().toISOString().slice(0, 10);

  const [metrics, overdue, lastSync] = await Promise.all([
    fetchJson<any>(`/api/pm/metrics?from=${from}&to=${to}&ownerName=${encodeURIComponent(ownerName)}`),
    fetchJson<any>(`/api/pm/overdue?from=${from}&to=${to}&ownerName=${encodeURIComponent(ownerName)}`),
    fetchJson<any>(`/api/health`),
  ]);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">PM Дашборд</h1>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">последний синк: {new Date(lastSync.nowUtc).toLocaleString('ru-RU')}</span>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600">Период:</span>
          <span className="text-sm">{from} — {to}</span>
          <span className="text-sm text-gray-600 ml-4">Owner:</span>
          <span className="text-sm">{ownerName}</span>
          <div className="ml-auto text-sm text-gray-500">Edit layout (MVP)</div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI label="Launch %" value={fmtPct(metrics.launchPct || 0)} sub={`${fmtNum(metrics.launchedCount)}/${fmtNum(metrics.signedCount)}`} />
        <KPI label="Missed %" value={fmtPct(metrics.missedPct || 0)} sub={`${fmtNum(metrics.missedCount)} шт.`} />
        <KPI label="Avg Integr→Pilot" value={fmtNum(metrics.avgIntegrationToPilotDays || 0)} sub="дней" />
      </div>

      <ChartLine data={metrics.trend || []} />

      <TableOverdue rows={overdue.rows || []} />
    </main>
  );
}

