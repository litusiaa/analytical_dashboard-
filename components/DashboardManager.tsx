"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';

type LinkItem = { id: string | number; dataSource?: { id: string | number; name: string; type: string } };
type WidgetItem = { id: string | number; title: string; type: string };
type DataSource = { id: number; name: string; type: string };

async function safeGet<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function DashboardManager({ slug, initialLinks, initialWidgets }: { slug: string; initialLinks: LinkItem[]; initialWidgets: WidgetItem[] }) {
  const [links, setLinks] = useState<LinkItem[]>(initialLinks);
  const [widgets, setWidgets] = useState<WidgetItem[]>(initialWidgets);
  const [allSources, setAllSources] = useState<DataSource[]>([]);

  // Modals
  const [openAddSource, setOpenAddSource] = useState(false);
  const [openAddWidget, setOpenAddWidget] = useState(false);

  // Add Source form
  const [srcName, setSrcName] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [srcRange, setSrcRange] = useState('Лист1!A1:Z1000');
  const [secret1, setSecret1] = useState('');
  const [loading1, setLoading1] = useState(false);
  const [err1, setErr1] = useState<string | null>(null);

  // Add Widget form
  const [wTitle, setWTitle] = useState('Новый виджет');
  const [wType, setWType] = useState<'table' | 'line' | 'bar'>('table');
  const [wDataSourceId, setWDataSourceId] = useState<number | undefined>(undefined);
  const [wRange, setWRange] = useState('Лист1!A1:Z100');
  const [secret2, setSecret2] = useState('');
  const [loading2, setLoading2] = useState(false);
  const [err2, setErr2] = useState<string | null>(null);

  async function refresh() {
    const [l, w, s] = await Promise.all([
      safeGet<{ items: LinkItem[] }>(`/api/dashboards/${slug}/data-sources`, { items: [] }),
      safeGet<{ items: WidgetItem[] }>(`/api/dashboards/${slug}/widgets`, { items: [] }),
      safeGet<{ items: DataSource[] }>(`/api/data-sources`, { items: [] }),
    ]);
    setLinks(l.items || []);
    setWidgets(w.items || []);
    setAllSources(s.items || []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleAddSource() {
    setLoading1(true);
    setErr1(null);
    try {
      const res1 = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret1}` },
        body: JSON.stringify({ type: 'google_sheets', name: srcName, spreadsheetUrl: srcUrl, defaultRange: srcRange }),
      });
      if (!res1.ok) throw new Error('Не удалось создать источник');
      const created = await res1.json();
      const srcId = created.id;

      const res2 = await fetch(`/api/dashboards/${slug}/data-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret1}` },
        body: JSON.stringify({ dataSourceId: srcId }),
      });
      if (!res2.ok) throw new Error('Источник создан, но не привязан к дашборду');
      await refresh();
      setOpenAddSource(false);
      setSrcName(''); setSrcUrl(''); setSrcRange('Лист1!A1:Z1000'); setSecret1('');
    } catch (e: any) {
      setErr1(e.message || 'Ошибка');
    } finally {
      setLoading1(false);
    }
  }

  async function handleAddWidget() {
    setLoading2(true);
    setErr2(null);
    try {
      const res = await fetch(`/api/dashboards/${slug}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret2}` },
        body: JSON.stringify({ type: wType, title: wTitle, dataSourceId: wDataSourceId, config: { range: wRange } }),
      });
      if (!res.ok) throw new Error('Не удалось создать виджет');
      await refresh();
      setOpenAddWidget(false);
      setWTitle('Новый виджет'); setWType('table'); setWRange('Лист1!A1:Z100'); setSecret2('');
    } catch (e: any) {
      setErr2(e.message || 'Ошибка');
    } finally {
      setLoading2(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setOpenAddSource(true)}>Добавить источник</Button>
        <Button variant="secondary" onClick={() => setOpenAddWidget(true)}>Добавить виджет</Button>
      </div>

      <Modal open={openAddSource} onClose={() => setOpenAddSource(false)} title="Добавить источник (Google Sheets)">
        <div className="space-y-3">
          <label className="block text-sm">Name
            <Input value={srcName} onChange={(e) => setSrcName(e.target.value)} placeholder="DS Main Sheet" />
          </label>
          <label className="block text-sm">Spreadsheet URL
            <Input value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
          </label>
          <label className="block text-sm">Range
            <Input value={srcRange} onChange={(e) => setSrcRange(e.target.value)} placeholder="Лист1!A1:Z1000" />
          </label>
          <label className="block text-sm">Admin Secret
            <Input type="password" value={secret1} onChange={(e) => setSecret1(e.target.value)} placeholder="Введите SYNC_SECRET" />
          </label>
          {err1 ? <div className="text-sm text-red-600">{err1}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddSource(false)}>Отмена</Button>
            <Button onClick={handleAddSource} disabled={loading1 || !srcName || !srcUrl || !secret1}>{loading1 ? 'Сохранение…' : 'Сохранить'}</Button>
          </div>
          <div className="text-xs text-gray-500">Дайте доступ редактора сервисному аккаунту: переменная GOOGLE_SHEETS_CLIENT_EMAIL</div>
        </div>
      </Modal>

      <Modal open={openAddWidget} onClose={() => setOpenAddWidget(false)} title="Добавить виджет">
        <div className="space-y-3">
          <label className="block text-sm">Заголовок
            <Input value={wTitle} onChange={(e) => setWTitle(e.target.value)} />
          </label>
          <label className="block text-sm">Тип
            <select className="border rounded px-3 py-2 text-sm w-full" value={wType} onChange={(e) => setWType(e.target.value as any)}>
              <option value="table">Table</option>
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          </label>
          <label className="block text-sm">Источник
            <select className="border rounded px-3 py-2 text-sm w-full" value={wDataSourceId ?? ''} onChange={(e) => setWDataSourceId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">— выберите источник —</option>
              {allSources.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">Диапазон (Range)
            <Input value={wRange} onChange={(e) => setWRange(e.target.value)} placeholder="Лист1!A1:D100" />
          </label>
          <label className="block text-sm">Admin Secret
            <Input type="password" value={secret2} onChange={(e) => setSecret2(e.target.value)} placeholder="Введите SYNC_SECRET" />
          </label>
          {err2 ? <div className="text-sm text-red-600">{err2}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddWidget(false)}>Отмена</Button>
            <Button onClick={handleAddWidget} disabled={loading2 || !wTitle || !wDataSourceId || !secret2}>{loading2 ? 'Сохранение…' : 'Сохранить'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}


