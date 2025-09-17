import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export default async function SourcesPage() {
  const data = await fetchJson<{ items: any[] }>(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/data-sources`);
  const items = data.items || [];
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Источники данных</h1>
        <span className="text-sm text-gray-500">Добавление — через API (MVP)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((s) => (
          <Card key={s.id}>
            <CardTitle>{s.name}</CardTitle>
            <CardContent className="mt-2 text-sm text-gray-600">
              <div>Тип: {s.type}</div>
              {s.spreadsheetId ? <div>Sheet ID: {s.spreadsheetId}</div> : null}
              {s.defaultRange ? <div>Диапазон по умолчанию: {s.defaultRange}</div> : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="text-sm text-gray-500">
        Подсказка: вы можете привязать источники к дашбордам на страницах `/dashboards/[slug]`.
      </div>
    </main>
  );
}

