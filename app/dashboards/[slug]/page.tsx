export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { NavBar } from '@/components/NavBar';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import React from 'react';
import { EditBanner } from '@/components/EditBanner';
import { DashboardManager } from '@/components/DashboardManager';
import { cookies } from 'next/headers';

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function DashboardSlugPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const links = await safeGet<{ items: any[] }>(`/api/dashboards/${slug}/data-sources`, { items: [] });
  const widgets = await safeGet<{ items: any[] }>(`/api/dashboards/${slug}/widgets`, { items: [] });

  const serviceEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL || 'bi-sheets-reader@grounded-will-439512-k9.iam.gserviceaccount.com';
  const isEdit = cookies().get('edit_mode')?.value === '1';

  return (
    <main>
      {isEdit ? <EditBanner /> : null}
      <NavBar title={slug.toUpperCase()} initialActive={isEdit} />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard: {slug.toUpperCase()}</h1>

      <Card>
        <CardHeader>Источники этого дашборда</CardHeader>
        <CardContent>
          <DashboardManager slug={slug} initialLinks={links.items} initialWidgets={widgets.items} serviceEmail={serviceEmail} canEdit={isEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>Виджеты</CardHeader>
        <CardContent>
          {widgets.items.length === 0 ? (
            <div className="text-sm text-gray-500">Нет виджетов, создайте первый</div>
          ) : (
            <ul className="list-disc pl-6 space-y-1">
              {widgets.items.map((w) => (
                <li key={w.id}>{w.title} ({w.type})</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}

