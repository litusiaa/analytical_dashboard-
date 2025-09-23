"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';

type LinkItem = { id: string | number; dataSource?: { id: string | number; name: string; type: string } };
type WidgetItem = { id: string | number; title: string; type: string };
function TableWidgetPreview({ dataSourceId, sheetTitle, range, pageSize = 1000 }: { dataSourceId: number; sheetTitle: string; range: string; pageSize?: number }) {
  const [state, setState] = React.useState<{ loading: boolean; error?: string; columns?: string[]; rows?: any[][]; total?: number }>({ loading: true });
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/data-sources/${dataSourceId}/read?sheet=${encodeURIComponent(sheetTitle)}&range=${encodeURIComponent(range)}&limit=${pageSize}&offset=0`, { cache: 'no-store', credentials: 'include' });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'Ошибка загрузки');
        if (!cancelled) setState({ loading: false, columns: j.columns || [], rows: j.rows || [], total: j.total });
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, error: e.message || 'Ошибка' });
      }
    })();
    return () => { cancelled = true; };
  }, [dataSourceId, sheetTitle, range]);

  if (state.loading) return <div className="text-xs text-gray-500">Loading…</div>;
  if (state.error) return <div className="text-xs text-red-600">{state.error}</div>;
  const cols = state.columns || [];
  const rows = state.rows || [];
  if (rows.length === 0) return <div className="text-xs text-gray-500">Пусто</div>;
  return (
    <div className="overflow-auto border rounded">
      <div className="text-[11px] text-gray-600 px-2 py-1">Rows: {state.total ?? rows.length}</div>
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {cols.map((c, i) => (<th key={i} className="px-2 py-1 text-left border-b">{String(c)}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
              {r.map((cell: any, ci: number) => (<td key={ci} className="px-2 py-1 border-b">{String(cell ?? '')}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
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

export function DashboardManager({ slug, initialLinks, initialWidgets, serviceEmail, canEdit }: { slug: string; initialLinks: LinkItem[]; initialWidgets: WidgetItem[]; serviceEmail: string; canEdit: boolean }) {
  const [links, setLinks] = useState<LinkItem[]>(initialLinks);
  const [widgets, setWidgets] = useState<WidgetItem[]>(initialWidgets);
  const [tab, setTab] = useState<'pub'|'draft'|'trash'>('pub');
  const [allSources, setAllSources] = useState<DataSource[]>([]);
  const [showDraftsInWidget, setShowDraftsInWidget] = useState(false);
  const [sourceSheets, setSourceSheets] = useState<Record<number, { title: string; range?: string }[]>>({});

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

  const [checking, setChecking] = useState<'idle'|'loading'|'ok'|'noaccess'|'invalid'|'nodata'>('idle');

  async function fetchMetadata(url: string) {
    setErr1(null);
    if (!url) return;
    setChecking('loading');
    const res = await fetch(`/api/sheets/metadata?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).message || 'Не удалось получить метаданные';
      if (msg.includes('403')) { setErr1('Выдайте доступ редактора сервисному аккаунту и повторите'); setChecking('noaccess'); }
      else if (msg.includes('Invalid')) { setErr1('Неверная ссылка Google Sheets'); setChecking('invalid'); }
      else { setErr1(msg); setChecking('idle'); }
      setSheets([]); setSelected({}); return;
    }
    const data = await res.json();
    setSrcName(data.title || 'Google Sheet');
    setSheets(data.sheets || []);
    const initial: Record<string, string> = {};
    (data.sheets || []).forEach((s: SheetMeta) => { initial[s.title] = s.rangeGuess || 'A1:Z'; });
    setSelected(initial);
    setChecking((data.sheets || []).length ? 'ok' : 'nodata');
  }

  // Add Widget form
  const [wTitle, setWTitle] = useState('Новый виджет');
  const [wType, setWType] = useState<'table' | 'line' | 'bar'>('table');
  const [wDataSourceId, setWDataSourceId] = useState<number | undefined>(undefined);
  const [wSheetTitle, setWSheetTitle] = useState<string>('');
  const [wRange, setWRange] = useState('A1:Z');
  const [secret2, setSecret2] = useState('');
  const [loading2, setLoading2] = useState(false);
  const [err2, setErr2] = useState<string | null>(null);

  async function refresh() {
    const [l, w] = await Promise.all([
      fetch(`/api/dashboards/${slug}/data-sources?ts=${Date.now()}`, { cache: 'no-store', credentials: 'include' }).then(r => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/dashboards/${slug}/widgets?ts=${Date.now()}`, { cache: 'no-store', credentials: 'include' }).then(r => r.json()).catch(() => ({ items: [] })),
    ]);
    const linksArr = l.items || [];
    setLinks(linksArr);
    setWidgets(w.items || []);
    // build unique sources from links for this dashboard only
    const unique = new Map<number, any>();
    for (const li of linksArr) {
      const ds: any = (li as any).dataSource;
      if (!ds) continue;
      unique.set(Number(ds.id), ds);
    }
    setAllSources(Array.from(unique.values()).filter((ds: any) => ds.status !== 'deleted'));
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
        credentials: 'include',
      });
      if (!res2.ok) {
        const txt = await res2.text();
        let err = 'Не удалось сохранить источник';
        try { const j = JSON.parse(txt); if (j?.error) err = j.error; else if (j?.message) err = j.message; } catch {}
        throw new Error(err);
      }
      const created = await res2.json();
      // Оптимистично добавим линк
      setLinks((prev) => [{ id: created.id, dataSource: { id: created.dataSourceId, name: srcName || 'Google Sheet', type: 'google_sheets' } }, ...prev]);
      // Пробуем перезапросить список; если неуспех — оставляем оптимистичный
      try {
        const resL = await fetch(`/api/dashboards/${slug}/data-sources?ts=${Date.now()}`, { cache: 'no-store' });
        if (resL.ok) {
          const dataL = await resL.json();
          setLinks(dataL.items || []);
        }
        // Авто‑виджет создаётся на сервере — подтянем список виджетов
        const resW = await fetch(`/api/dashboards/${slug}/widgets?ts=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
        if (resW.ok) {
          const dataW = await resW.json();
          setWidgets(dataW.items || []);
        }
      } catch {}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'table', title: wTitle, dataSourceId: wDataSourceId, sheetTitle: wSheetTitle, range: wRange, options: { pageSize: 50 } }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Не удалось создать виджет');
      const created = await res.json();
      setWidgets([{ id: created.id, title: created.title, type: created.type }, ...widgets]);
      await refresh();
      setOpenAddWidget(false);
      setWTitle('Новый виджет'); setWType('table'); setWRange('A1:Z'); setWSheetTitle(''); setSecret2('');
    } catch (e: any) {
      setErr2(e.message || 'Ошибка');
    } finally {
      setLoading2(false);
    }
  }

  // server provides canEdit prop; do not rely on document here

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => (canEdit ? setOpenAddSource(true) : null)} disabled={!canEdit} title={canEdit ? '' : 'Включите Edit dashboard, чтобы редактировать'}>Добавить источник</Button>
        <Button variant="secondary" onClick={() => (canEdit ? setOpenAddWidget(true) : null)} disabled={!canEdit} title={canEdit ? '' : 'Включите Edit dashboard, чтобы редактировать'}>Добавить виджет</Button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <button className={`px-2 py-1 rounded ${tab==='pub'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setTab('pub')}>Опубликованные</button>
        <button className={`px-2 py-1 rounded ${tab==='draft'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setTab('draft')}>Черновики</button>
        <button className={`px-2 py-1 rounded ${tab==='trash'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setTab('trash')}>Корзина</button>
      </div>

      <div className="mt-3">
        {links.length === 0 ? (
          <div className="text-sm text-gray-500">Нет источников, нажмите «Добавить источник»</div>
        ) : (
          <ul className="list-disc pl-6 space-y-1">
            {links
              .filter((l) => {
                const st = (l as any).dataSource?.status;
                if (tab==='trash') return st==='deleted';
                if (tab==='draft') return st==='draft';
                return st==='published' || !st;
              })
              .map((l) => {
              const ds: any = (l as any).dataSource || {};
              const status: string | undefined = ds.status;
              return (
                <li key={l.id} className="flex items-center gap-2">
                  <span>{ds.name || 'Источник'} ({ds.type || '—'})</span>
                  {status ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'published' ? 'bg-green-100 text-green-700' : status==='draft' ? 'bg-amber-100 text-amber-800' : 'bg-gray-300 text-gray-700'}`}>{status === 'published' ? 'Published' : status==='draft'?'Draft':'Deleted'}</span>
                  ) : null}
                  {canEdit && status!=='deleted' ? (
                    <button className="ml-auto text-red-600 text-xs" onClick={async () => {
                      if (!confirm('Переместить источник в корзину?')) return;
                      const res = await fetch(`/api/dashboards/${slug}/data-sources/${l.id}`, { method: 'DELETE', credentials: 'include' });
                      if (res.status === 409) {
                        const j = await res.json().catch(() => ({}));
                        const titles = (j.widgets || []).map((w: any) => w.title).join(', ');
                        if (confirm(`Источник используется виджетами: ${titles}\nУдалить вместе с виджетами?`)) {
                          await fetch(`/api/dashboards/${slug}/data-sources/${l.id}?force=true`, { method: 'DELETE', credentials: 'include' });
                        } else {
                          return;
                        }
                      }
                      // оптимистично скрываем связь в текущей вкладке
                      setLinks((prev) => prev.filter((x) => x.id !== l.id));
                      await refresh();
                    }}>Удалить</button>
                  ) : null}
                  {canEdit && status==='deleted' ? (
                    <div className="ml-auto flex items-center gap-2">
                      <button className="text-xs text-blue-600" onClick={async ()=>{
                        await fetch(`/api/dashboards/${slug}/data-sources/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore' }), credentials: 'include' });
                        setLinks((prev)=>prev.map((x:any)=> x.id===l.id ? { ...x, status: 'draft' } : x));
                        await refresh();
                      }}>Восстановить</button>
                      <button className="text-xs text-red-700" onClick={async ()=>{
                        if (!confirm('Удалить источник навсегда? Это действие необратимо.')) return;
                        await fetch(`/api/dashboards/${slug}/data-sources/${l.id}?hard=true`, { method: 'DELETE', credentials: 'include' });
                        setLinks((prev)=>prev.filter((x)=> x.id !== l.id));
                        await refresh();
                      }}>Удалить навсегда</button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <div className="text-sm font-medium mb-2">Виджеты</div>
        {widgets.length === 0 ? (
          <div className="text-sm text-gray-500">Нет виджетов, создайте первый</div>
        ) : (
          <ul className="space-y-2">
            {widgets
              .filter((w: any) => {
                const st = (w as any).status;
                if (tab==='trash') return st==='deleted';
                if (tab==='draft') return st==='draft';
                return st==='published' || !st;
              })
              .map((w) => (
              <li key={w.id} className="border rounded p-2 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>{w.title} ({w.type})</div>
                  {canEdit && (w as any).status!=='deleted' ? (
                    <button className="text-red-600 text-xs" onClick={async () => {
                      if (!confirm('Переместить виджет в корзину?')) return;
                      await fetch(`/api/dashboards/${slug}/widgets/${w.id}`, { method: 'DELETE', credentials: 'include' });
                      setWidgets((prev) => prev.map((x: any) => x.id === w.id ? { ...x, status: 'deleted' } : x));
                      await refresh();
                    }}>Удалить</button>
                  ) : null}
                  {canEdit && (w as any).status==='deleted' ? (
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-blue-600" onClick={async ()=>{
                        await fetch(`/api/dashboards/${slug}/widgets/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore' }), credentials: 'include' });
                        setWidgets((prev)=>prev.map((x:any)=> x.id===w.id ? { ...x, status: 'draft' } : x));
                        await refresh();
                      }}>Восстановить</button>
                      <button className="text-xs text-red-700" onClick={async ()=>{
                        if (!confirm('Удалить виджет навсегда?')) return;
                        await fetch(`/api/dashboards/${slug}/widgets/${w.id}?hard=true`, { method: 'DELETE', credentials: 'include' });
                        setWidgets((prev)=>prev.filter((x)=> x.id !== w.id));
                        await refresh();
                      }}>Удалить навсегда</button>
                    </div>
                  ) : null}
                </div>
                {w.type === 'table' ? (
                  <TableWidgetPreview dataSourceId={(w as any).config?.dataSourceId || 0} sheetTitle={(w as any).config?.sheetTitle || ''} range={(w as any).config?.range || 'A1:Z'} pageSize={(w as any).config?.options?.pageSize || 1000} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Modal open={canEdit && openAddSource} onClose={() => setOpenAddSource(false)} title="Добавить источник (Google Sheets)">
        <div className="space-y-3">
          {/* success toast placeholder (removed undefined component) */}
          <label className="block text-sm">Name
            <Input value={srcName} onChange={(e) => setSrcName(e.target.value)} placeholder="DS Main Sheet" />
          </label>
          <label className="block text-sm">Spreadsheet URL
            <Input value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fetchMetadata(srcUrl); }} onBlur={(e) => fetchMetadata(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
          </label>
          {checking === 'loading' ? <div className="text-xs text-gray-600 flex items-center gap-2"><Spinner /> Проверяем доступ…</div> : null}
          {checking === 'ok' ? <div className="text-xs text-green-700">Доступ есть, найдено {sheets.length} листов</div> : null}
          {checking === 'noaccess' ? <div className="text-xs text-red-700">Нет доступа</div> : null}
          {checking === 'invalid' ? <div className="text-xs text-red-700">Неверная ссылка Google Sheets</div> : null}
          {checking === 'nodata' ? <div className="text-xs text-yellow-700">Листы не найдены. Проверьте доступ и содержимое файла.</div> : null}
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
          {err1 ? (
            <div className="text-sm text-red-600">
              {err1}
              {checking === 'noaccess' ? (
                <div className="mt-2 text-xs">
                  Нет доступа к таблице. Добавьте сервисный аккаунт как «Редактор» и попробуйте снова.
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="border rounded p-2 text-xs text-gray-600">
            <div className="font-medium text-gray-500 mb-1">Доступ сервисному аккаунту</div>
            <div>Чтобы приложение могло читать таблицу, добавьте этого пользователя в Google Sheets с правами «Редактор»:</div>
            <div className="mt-2 flex items-center gap-2">
              <Input readOnly value={serviceEmail} className="flex-1" />
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(serviceEmail); alert('Скопировано'); }}>Скопировать</Button>
              <button className="text-blue-600 underline" onClick={() => alert('1) В таблице нажмите «Поделиться»\n2) Вставьте адрес сервисного аккаунта\n3) Выберите «Редактор» → «Готово»')}>Как дать доступ?</button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddSource(false)}>Отмена</Button>
        <Button onClick={handleAddSource} disabled={loading1 || !srcUrl || Object.keys(selected).length === 0}>{loading1 ? (<><Spinner /> <span className="ml-2">Сохраняем…</span></>) : 'Сохранить'}</Button>
          </div>
          <div className="text-xs text-gray-500">Дайте доступ редактора сервисному аккаунту: переменная GOOGLE_SHEETS_CLIENT_EMAIL</div>
        </div>
      </Modal>

      <Modal open={openAddWidget} onClose={() => setOpenAddWidget(false)} title="Добавить виджет">
        <div className="space-y-3">
          <label className="block text-sm">Заголовок
            <Input value={wTitle} onChange={(e) => setWTitle(e.target.value)} />
          </label>
          <div className="text-xs text-gray-600">Тип: Table</div>
          <label className="block text-sm">Источник
            <div className="flex items-center gap-2 mb-1 text-xs">
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showDraftsInWidget} onChange={(e)=>setShowDraftsInWidget(e.target.checked)} /> Показывать черновики</label>
            </div>
            <select className="border rounded px-3 py-2 text-sm w-full" value={wDataSourceId ?? ''} onChange={async (e) => {
              const id = e.target.value ? Number(e.target.value) : undefined;
              setWDataSourceId(id);
              if (id) {
                try {
                  const res = await fetch(`/api/data-sources/${id}`, { cache: 'no-store', credentials: 'include' });
                  if (res.ok) {
                    const j = await res.json();
                    const arr = (j.sheets || []) as { title: string; range?: string }[];
                    setSourceSheets((prev)=>({ ...prev, [id]: arr }));
                    if (arr.length === 1) {
                      setWSheetTitle(arr[0].title);
                      setWRange(arr[0].range || 'A1:Z');
                    }
                  }
                } catch {}
              }
            }}>
              <option value="">— выберите источник —</option>
              {Array.from(new Map(allSources.filter((s:any)=> (showDraftsInWidget ? s.status!=='deleted' : s.status==='published')).sort((a:any,b:any)=> new Date(b.updatedAt||0).getTime() - new Date(a.updatedAt||0).getTime()).map((s:any)=>[s.id,s])).values()).map((s:any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.type}){s.status==='draft'?' — Draft':''}</option>
              ))}
            </select>
          </label>
          {wDataSourceId && (sourceSheets[wDataSourceId]?.length || 0) > 1 ? (
            <label className="block text-sm">Лист
              <select className="border rounded px-3 py-2 text-sm w-full" value={wSheetTitle} onChange={(e)=>{
                const t = e.target.value; setWSheetTitle(t);
                const sheet = (sourceSheets[wDataSourceId!]||[]).find(s=>s.title===t);
                if (sheet) setWRange(sheet.range || 'A1:Z');
              }}>
                <option value="">— выберите лист —</option>
                {(sourceSheets[wDataSourceId]||[]).map(s => (<option key={s.title} value={s.title}>{s.title}</option>))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm">Sheet title
            <Input value={wSheetTitle} onChange={(e) => setWSheetTitle(e.target.value)} placeholder="Лист1" />
          </label>
          <label className="block text-sm">Диапазон (Range)
            <Input value={wRange} onChange={(e) => setWRange(e.target.value)} placeholder="A1:Z" />
          </label>
          {/* Admin Secret removed for UI operations */}
          {err2 ? <div className="text-sm text-red-600">{err2}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddWidget(false)}>Отмена</Button>
            <Button onClick={handleAddWidget} disabled={loading2 || !wTitle || !wDataSourceId || !wSheetTitle}>{loading2 ? 'Сохранение…' : 'Сохранить'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}


