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

type SheetMeta = { title: string; rangeGuess: string };

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
  const [sheets, setSheets] = useState<SheetMeta[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({}); // title -> range
  const [loading1, setLoading1] = useState(false);
  const [err1, setErr1] = useState<string | null>(null);

  async function fetchMetadata(url: string) {
    setErr1(null);
    if (!url) return;
    const res = await fetch(`/api/sheets/metadata?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).message || 'Не удалось получить метаданные';
      setErr1(msg.includes('403') ? 'Нет доступа. Выдайте редакторский доступ сервисному аккаунту и повторите.' : msg);
      setSheets([]); setSelected({}); return;
    }
    const data = await res.json();
    setSrcName(data.title || 'Google Sheet');
    setSheets(data.sheets || []);
    const initial: Record<string, string> = {};
    (data.sheets || []).forEach((s: SheetMeta) => { initial[s.title] = s.rangeGuess || 'A1:Z'; });
    setSelected(initial);
  }

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
      const payload = {
        name: srcName || undefined,
        spreadsheetUrl: srcUrl,
        sheets: Object.entries(selected).map(([title, range]) => ({ title, range })),
      };
      const res2 = await fetch(`/api/dashboards/${slug}/data-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res2.ok) throw new Error((await res2.json().catch(() => ({}))).message || 'Не удалось сохранить источник');
      await refresh();
      setOpenAddSource(false);
      setSrcName(''); setSrcUrl(''); setSheets([]); setSelected({});
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
            <Input value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} onBlur={(e) => fetchMetadata(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
          </label>
          {sheets.length > 0 ? (
            <div className="border rounded p-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Листы</div>
                <div className="flex gap-2 text-xs">
                  <button className="text-blue-600" onClick={() => { const all: Record<string, string> = {}; sheets.forEach(s => all[s.title] = selected[s.title] ?? s.rangeGuess ?? 'A1:Z'); setSelected(all); }}>Выбрать все</button>
                  <button className="text-blue-600" onClick={() => setSelected({})}>Очистить</button>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {sheets.map((s) => (
                  <div key={s.title} className="flex items-center gap-2">
                    <input type="checkbox" checked={selected[s.title] !== undefined} onChange={(e) => {
                      const copy = { ...selected };
                      if (e.target.checked) copy[s.title] = copy[s.title] ?? (s.rangeGuess || 'A1:Z'); else delete copy[s.title];
                      setSelected(copy);
                    }} />
                    <div className="text-sm flex-1">{s.title}
                      <div className="text-xs text-gray-500">предпросмотр: {selected[s.title] ?? s.rangeGuess ?? 'A1:Z'}</div>
                    </div>
                    {selected[s.title] !== undefined ? (
                      <Input className="w-32" value={selected[s.title]} onChange={(e) => setSelected({ ...selected, [s.title]: e.target.value })} />
                    ) : null}
                    {selected[s.title] !== undefined ? (
                      <button className="text-xs text-blue-600" onClick={async () => {
                        const res = await fetch(`/api/sheets/preview?url=${encodeURIComponent(srcUrl)}&sheet=${encodeURIComponent(s.title)}&range=${encodeURIComponent(selected[s.title])}`);
                        const data = await res.json();
                        alert(JSON.stringify(data.rows || [], null, 2));
                      }}>Предпросмотр</button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {err1 ? <div className="text-sm text-red-600">{err1}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddSource(false)}>Отмена</Button>
            <Button onClick={handleAddSource} disabled={loading1 || !srcUrl || Object.keys(selected).length === 0}>{loading1 ? 'Сохранение…' : 'Сохранить'}</Button>
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


