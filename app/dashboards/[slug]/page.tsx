import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export default async function DashboardSlugPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const links = await fetchJson<{ items: any[] }>(`/api/dashboards/${slug}/data-sources`);
  const widgets = await fetchJson<{ items: any[] }>(`/api/dashboards/${slug}/widgets`);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Дашборд: {slug.toUpperCase()}</h1>

      <Card>
        <CardHeader>Источники этого дашборда</CardHeader>
        <CardContent>
          <ul className="list-disc pl-6 space-y-1">
            {links.items.map((l) => (
              <li key={l.id}>{l.dataSource?.name} ({l.dataSource?.type})</li>
            ))}
          </ul>
          <div className="text-sm text-gray-500 mt-2">Привязка через POST /api/dashboards/{slug}/data-sources (MVP)</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Виджеты</CardHeader>
        <CardContent>
          {widgets.items.length === 0 ? (
            <div className="text-sm text-gray-500">Пока нет виджетов. Добавьте через POST /api/dashboards/{slug}/widgets</div>
          ) : (
            <ul className="list-disc pl-6 space-y-1">
              {widgets.items.map((w) => (
                <li key={w.id}>{w.title} ({w.type})</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

