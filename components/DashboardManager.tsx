"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { GOOGLE_CALENDAR_CLIENT_ID } from '@/lib/publicEnv';

type LinkItem = { id: string | number; dataSource?: { id: string | number; name: string; type: string } };
type WidgetItem = { id: string | number; title: string; type: string };

// Предустановленные корпоративные календари для быстрого выбора
const STAFF_CALENDARS: Array<{ id: string; summary: string }> = [
  { id: 'em@dbrain.io', summary: 'Егор Москвин' },
  { id: 'k.polyakov@dbrain.io', summary: 'Константин Поляков' },
  { id: 'maksim.k@dbrain.io', summary: 'Максим Короткевич' },
  { id: 'ekaterina.bogdanova@dbrain.io', summary: 'Екатерина Богданова' },
  { id: 'valeria.ivanova@dbrain.io', summary: 'Валерия Иванова' },
  { id: 'polina.svavilnaya@dbrain.io', summary: 'Полина Свавильная' },
  { id: 'ks@dbrain.io', summary: 'Кирилл Стасюкевич' },
  { id: 'evgenia.popova@dbrain.io', summary: 'Евгения Попова' },
  { id: 'mp@dbrain.io', summary: 'Мария Паращенко' },
];
function TableWidgetPreview({ dataSourceId, sheetTitle, range, pageSize = 1000, canEdit = false, slug, widget }: { dataSourceId: number; sheetTitle: string; range: string; pageSize?: number; canEdit?: boolean; slug: string; widget?: any }) {
  const [state, setState] = React.useState<{ loading: boolean; error?: string; columns?: string[]; rows?: any[][]; total?: number }>({ loading: true });
  const [page, setPage] = React.useState(0);
  const [pageSizeState, setPageSizeState] = React.useState<number>(pageSize);
  const [preview, setPreview] = React.useState<{ columns: { key: string; type?: string }[]; distinct: Record<string, any[]> } | null>(null);
  const [activeFilterCol, setActiveFilterCol] = React.useState<string>('');
  const [selectedValues, setSelectedValues] = React.useState<Record<string, Set<string>>>(() => ({}));
  const presets = (widget?.config?.filterPresets || []) as Array<{ id: string; name: string; filters: any; isDefault?: boolean }>;

  function encodeFilters(): string | undefined {
    const items: any[] = [];
    Object.entries(selectedValues).forEach(([col, set]) => {
      if (set.size > 0) items.push({ col, op: 'in', value: Array.from(set) });
    });
    if (items.length === 0) return undefined;
    const tree = { op: 'AND', items };
    try {
      const json = JSON.stringify(tree);
      // utf8 -> b64
      const b64 = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
      return b64;
    } catch { return undefined; }
  }

  async function fetchPage(curPage: number) {
    const psize = pageSizeState;
    const offset = curPage * psize;
    const filters = encodeFilters();
    const qs = new URLSearchParams({ sheet: sheetTitle, range, limit: String(psize), offset: String(offset) });
    if (filters) qs.set('filters', filters);
    const res = await fetch(`/api/data-sources/${dataSourceId}/read?${qs.toString()}`, { cache: 'no-store', credentials: 'include' });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || 'Ошибка загрузки');
    setState({ loading: false, columns: j.columns || [], rows: j.rows || [], total: j.total });
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: undefined }));
        // Apply default preset once (only on mount for this widget)
        if (presets && presets.length > 0) {
          const def = presets.find((p) => p.isDefault) || null;
          if (def && def.filters && def.filters.items) {
            const next: Record<string, Set<string>> = {};
            for (const it of def.filters.items) {
              if (it && it.col && Array.isArray(it.value)) {
                next[it.col] = new Set<string>(it.value.map((x: any) => String(x)));
              }
            }
            if (Object.keys(next).length > 0) setSelectedValues(next);
          }
        }
        await fetchPage(0);
        if (cancelled) return;
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, error: e.message || 'Ошибка' });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceId, sheetTitle, range]);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/data-sources/${dataSourceId}/preview?sheet=${encodeURIComponent(sheetTitle)}&range=${encodeURIComponent(range)}`, { cache: 'no-store' });
        if (res.ok) setPreview(await res.json());
      } catch {}
    })();
  }, [dataSourceId, sheetTitle, range]);

  if (state.loading) return <div className="text-xs text-gray-500">Loading…</div>;
  if (state.error) return <div className="text-xs text-red-600">{state.error}</div>;
  const cols = state.columns || [];
  const rows = state.rows || [];
  const total = state.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSizeState)));

  function renderCell(v: any) {
    const empty = v === null || v === undefined || String(v) === '';
    if (empty) return <span className="text-gray-400" title="Пусто">—</span>;
    const s = String(v);
    return <span title={s} className="whitespace-pre-wrap break-words">{s}</span>;
  }

  return (
    <div className="space-y-2">
      {/* Filters panel */}
      {preview ? (
        <div className="border rounded p-2 text-xs bg-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            <select className="border rounded px-2 py-1" value={activeFilterCol} onChange={(e)=> setActiveFilterCol(e.target.value)}>
              <option value="">— колонка —</option>
              {preview.columns.map((c)=> (<option key={c.key} value={c.key}>{c.key}</option>))}
            </select>
            {activeFilterCol ? (
              <select className="border rounded px-2 py-1" multiple size={3} value={Array.from(selectedValues[activeFilterCol]||[])} onChange={(e)=>{
                const set = new Set<string>();
                Array.from(e.target.selectedOptions).forEach(o=> set.add(o.value));
                setSelectedValues((prev)=> ({ ...prev, [activeFilterCol]: set }));
              }}>
                {(preview.distinct[activeFilterCol] || []).map((v, i)=> (
                  <option key={i} value={String(v ?? '')}>{String(v ?? '')}</option>
                ))}
              </select>
            ) : null}
            <button className="ml-auto underline" onClick={async ()=>{ setPage(0); await fetchPage(0); }}>Применить</button>
            <button className="underline" onClick={async ()=>{ setSelectedValues({}); setPage(0); await fetchPage(0); }}>Сбросить</button>
            {canEdit ? (
              <>
                <button className="underline" onClick={async ()=>{
                  const name = prompt('Название пресета фильтров');
                  if (!name) return;
                  const items: any[] = [];
                  Object.entries(selectedValues).forEach(([col, set]) => { if (set.size>0) items.push({ col, op: 'in', value: Array.from(set) }); });
                  const tree = { op: 'AND', items };
                  const newPreset = { id: String(Date.now()), name, filters: tree };
                  const cfg = { ...(widget?.config||{}), filterPresets: [ ...(widget?.config?.filterPresets||[]), newPreset ] };
                  await fetch(`/api/dashboards/${slug}/widgets/${widget.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }), credentials: 'include' });
                  alert('Пресет сохранён');
                }}>Сохранить как пресет</button>
                {presets && presets.length>0 ? (
                  <>
                    <select className="border rounded px-2 py-1" onChange={async (e)=>{
                      const pid = e.target.value; if (!pid) return;
                      const p = presets.find((x)=> String(x.id)===pid); if (!p) return;
                      const next: Record<string, Set<string>> = {};
                      (p.filters?.items||[]).forEach((it: any)=>{ if (it.col && Array.isArray(it.value)) next[it.col]= new Set(it.value.map((x:any)=> String(x))); });
                      setSelectedValues(next); setPage(0); await fetchPage(0);
                    }}>
                      <option value="">— пресеты —</option>
                      {presets.map((p)=> (<option key={p.id} value={p.id}>{p.name}{p.isDefault?' (по умолчанию)':''}</option>))}
                    </select>
                    <button className="underline" onClick={async ()=>{
                      const pid = prompt('ID пресета, сделать по умолчанию');
                      if (!pid) return;
                      const nextList = (widget?.config?.filterPresets||[]).map((p:any)=> ({ ...p, isDefault: String(p.id)===pid }));
                      const cfg = { ...(widget?.config||{}), filterPresets: nextList };
                      await fetch(`/api/dashboards/${slug}/widgets/${widget.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }), credentials: 'include' });
                      alert('Пресет установлен по умолчанию');
                    }}>Сделать пресет по умолчанию</button>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
          {/* Chips */}
          <div className="mt-2 flex gap-2 flex-wrap">
            {Object.entries(selectedValues).flatMap(([col, set]) => Array.from(set).map((val) => (
              <span key={col+':'+val} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                <span>{col}: {val}</span>
                <button onClick={async ()=>{ const copy = new Set(selectedValues[col]); copy.delete(val); setSelectedValues({ ...selectedValues, [col]: copy }); setPage(0); await fetchPage(0); }}>×</button>
              </span>
            )))}
          </div>
        </div>
      ) : null}

      {/* Table */}
      {rows.length === 0 ? <div className="text-xs text-gray-500">Пусто</div> : (
        <div className="overflow-auto border rounded">
          <div className="text-[11px] text-gray-600 px-2 py-1 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>Rows: {total}</div>
              <div className="flex items-center gap-1">Строк на странице:
                <select className="border rounded px-1 py-0.5" value={pageSizeState} onChange={async (e)=>{ const v = e.target.value==='all' ? total : Number(e.target.value); setPageSizeState(v); setPage(0); await fetchPage(0); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value="all">Все</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-0.5 border rounded text-xs" disabled={page<=0} onClick={async ()=>{ const np = Math.max(0, page-1); setPage(np); await fetchPage(np); }}>Prev</button>
              <span className="text-gray-500">{page+1}/{totalPages}</span>
              <button className="px-2 py-0.5 border rounded text-xs" disabled={page+1>=totalPages} onClick={async ()=>{ const np = Math.min(totalPages-1, page+1); setPage(np); await fetchPage(np); }}>Next</button>
            </div>
          </div>
          <table className="min-w-full text-xs table-fixed border-separate border-spacing-0">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 px-2 py-1 text-left border border-gray-200">#</th>
                {cols.map((c, i) => (
                  <th key={i} className={`px-2 py-1 text-left border border-gray-200 ${i===0?'sticky left-10 z-10 bg-gray-50':''}`}>{String(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className={`hover:bg-gray-100 ${idx % 2 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="sticky left-0 z-10 bg-inherit px-2 py-1 border border-gray-200 text-right w-10">{page*pageSizeState + idx + 1}</td>
                  {r.map((cell: any, ci: number) => (
                    <td key={ci} className={`px-2 py-1 border border-gray-200 align-top ${ci===0?'sticky left-10 bg-inherit':''}`}>{renderCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CalendarWidgetPreview({ config }: { config: any }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError(null);
        const opts = (config && (config.options ? config.options : config)) || {};
        const ids = Array.isArray(opts.calendars) ? opts.calendars.join(',') : '';
        const now = new Date();
        const timeMin = now.toISOString();
        const mode = (opts.mode || 'day') as 'day'|'week'|'month';
        const days = mode === 'day' ? 1 : mode === 'week' ? 7 : 30;
        const timeMax = new Date(now.getTime() + days*24*3600*1000).toISOString();
        const r = await fetch(`/api/calendar/events?calendarId=${encodeURIComponent(ids)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Ошибка');
        setItems(j.items || []);
      } catch (e: any) { setError(e.message || 'Ошибка'); } finally { setLoading(false); }
    })();
  }, [JSON.stringify(config||{})]);
  if (loading) return <div className="text-xs text-gray-500">Loading…</div>;
  if (error) return <div className="text-xs text-red-600">{error}</div>;
  if (!items.length) return <div className="text-xs text-gray-500">Нет событий</div>;
  return (
    <div className="space-y-1">
      {items.map((e, i) => (
        <div key={i} className="border rounded p-2 bg-white text-sm">
          <div className="flex items-center justify-between">
            <div className="text-gray-700">{new Date(e.start).toLocaleString('ru-RU')}</div>
            {e.hangoutLink ? <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded">Meet</span> : null}
          </div>
          <div className="font-medium break-words">{e.summary || 'Без названия'}</div>
          <div className="text-[12px] text-gray-500 break-words">Организатор: {e.organizer || '-'}</div>
          <div className="text-[12px] text-gray-500">Участники: {(e.attendees||[]).length}</div>
          {e.hangoutLink ? <a className="text-[12px] text-blue-600 underline" href={e.hangoutLink} target="_blank" rel="noreferrer">Ссылка</a> : null}
        </div>
      ))}
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
  const [layout, setLayout] = useState<Record<number, { x: number; y: number; width: number; height: number; zIndex: number }>>({});
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const isInteractingRef = useRef(false);
  const [tab, setTab] = useState<'pub'|'draft'|'trash'>(canEdit ? 'draft' : 'pub');
  const visibleWidgets = useMemo(() => widgets.filter((w: any) => { const st = (w as any).status; if (tab==='trash') return st==='deleted'; if (tab==='draft') return st==='draft'; return st==='published' || !st; }), [widgets, tab]);
  const containerHeight = useMemo(() => {
    let h = 300;
    visibleWidgets.forEach((w: any, idx: number) => {
      const id = Number((w as any).id);
      const r = layout[id] || defaultRect(idx);
      h = Math.max(h, (r.y || 0) + (r.height || 0) + 16);
    });
    return h;
  }, [visibleWidgets, layout]);
  const [allSources, setAllSources] = useState<DataSource[]>([]);
  const [showDraftsInWidget, setShowDraftsInWidget] = useState(false);
  const [sourceSheets, setSourceSheets] = useState<Record<number, { title: string; range?: string }[]>>({});

  // Modals
  const [openAddSheets, setOpenAddSheets] = useState(false);
  const [openAddPipedrive, setOpenAddPipedrive] = useState(false);
  const [openAddWidget, setOpenAddWidget] = useState(false);
  const [openAddCalendar, setOpenAddCalendar] = useState(false);

  // Add Source form
  const [srcName, setSrcName] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [sheets, setSheets] = useState<SheetMeta[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({}); // title -> range
  const [loading1, setLoading1] = useState(false);
  const [err1, setErr1] = useState<string | null>(null);
  // Pipedrive fields
  const [pdEntity, setPdEntity] = useState<'deals'|'persons'|'organizations'|'activities'>('deals');
  const [pdPipelineId, setPdPipelineId] = useState('');
  const [pdStageIds, setPdStageIds] = useState('');
  const [pdOwnerIds, setPdOwnerIds] = useState('');
  const [pdDateField, setPdDateField] = useState('');
  const [pdDateFrom, setPdDateFrom] = useState('');
  const [pdDateTo, setPdDateTo] = useState('');
  const [pdFields, setPdFields] = useState('');
  const [pdSavedFilterId, setPdSavedFilterId] = useState('');
  const [pdPreview, setPdPreview] = useState<{ columns: { key: string; type?: string }[]; sample: any[] } | null>(null);
  const [pdPipelines, setPdPipelines] = useState<Array<{ id: number; name: string }>>([]);
  const [pdStagesAll, setPdStagesAll] = useState<Array<{ id: number; name: string; pipeline_id: number }>>([]);
  const [pdOwners, setPdOwners] = useState<Array<{ id: number; name: string }>>([]);
  const [pdFieldsList, setPdFieldsList] = useState<Array<{ key: string; name: string }>>([]);
  const [pdFilters, setPdFilters] = useState<Array<{ id: number; name: string }>>([]);
  const [pdOwnerQuery, setPdOwnerQuery] = useState('');
  const [pdFieldQuery, setPdFieldQuery] = useState('');
  const [pdFieldsSel, setPdFieldsSel] = useState<Set<string>>(new Set());

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
  const [wType, setWType] = useState<'table' | 'line' | 'bar' | 'pie' | 'calendar'>('table');
  const [wDataSourceId, setWDataSourceId] = useState<number | undefined>(undefined);
  const [wSheetTitle, setWSheetTitle] = useState<string>('');
  const [wRange, setWRange] = useState('A1:Z');
  const [wMapping, setWMapping] = useState<{ x?: string; y?: string; category?: string; groupBy?: string; aggregate?: 'sum'|'count'|'avg'|'min'|'max' }>({});
  const [miniCols, setMiniCols] = useState<{ key: string; type?: string }[]>([]);
  const [miniRows, setMiniRows] = useState<any[][]>([]);
  const [miniLoading, setMiniLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ x?: string; y?: string; category?: string }>(()=>({}));
  const [secret2, setSecret2] = useState('');
  const [loading2, setLoading2] = useState(false);
  const [err2, setErr2] = useState<string | null>(null);
  // Calendar widget state
  const [calList, setCalList] = useState<Array<{ id: string; summary: string; primary?: boolean; accessRole?: string }>>([]);
  const [calQuery, setCalQuery] = useState('');
  const [calSelected, setCalSelected] = useState<Set<string>>(()=> new Set());
  const [calMode, setCalMode] = useState<'day'|'week'|'month'>('day');
  const [calPreview, setCalPreview] = useState<any[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string>('');
  const clientId = GOOGLE_CALENDAR_CLIENT_ID;
  const [hasClientId, setHasClientId] = useState<boolean>(Boolean(clientId));
  const [calConfigChecked, setCalConfigChecked] = useState<boolean>(false);

  useEffect(() => {
    if (!openAddCalendar && !openAddWidget) return;
    (async () => {
      try {
        // Fallback probe
        try {
          const c = await fetch('/api/calendar/config', { cache: 'no-store' });
          const j = await c.json(); setHasClientId(Boolean(j?.hasClientId));
        } catch { setHasClientId(Boolean(clientId)); }
        finally { setCalConfigChecked(true); }
        if (calList.length === 0) {
          const r = await fetch('/api/calendar/list', { cache: 'no-store' });
          const j = await r.json();
          if (r.ok) { setCalList(j || []); setCalError(''); } else { setCalError(j?.error || 'Не удалось получить календари'); }
        }
      } catch {}
    })();
  }, [openAddCalendar, openAddWidget]);

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
      const linkStatus: string | undefined = (li as any).status;
      if (linkStatus === 'deleted') continue; // не берём удалённые связи в источники для модалки
      unique.set(Number(ds.id), ds);
    }
    setAllSources(Array.from(unique.values()).filter((ds: any) => ds.status !== 'deleted'));
  }

  function lettersToIndex(letters: string): number {
    let idx = 0;
    for (let i = 0; i < letters.length; i++) {
      const ch = letters.charCodeAt(i) - 64; // 'A' => 1
      idx = idx * 26 + ch;
    }
    return idx; // 1-based
  }

  function normalizeRange(r?: string): { colEnd?: number; rowEnd?: number } {
    if (!r) return {};
    const m = r.match(/^[A-Za-z]+\d*:([A-Za-z]+)(\d+)?$/);
    if (!m) return {};
    const colEnd = lettersToIndex(m[1].toUpperCase());
    const rowEnd = m[2] ? Number(m[2]) : undefined;
    return { colEnd, rowEnd };
  }

  function chooseMaxRange(ranges: (string | undefined)[]): string {
    let bestCol = 0;
    let bestRow = 0;
    for (const r of ranges) {
      const { colEnd, rowEnd } = normalizeRange(r);
      if ((colEnd || 0) > bestCol) bestCol = colEnd || 0;
      if ((rowEnd || 0) > bestRow) bestRow = rowEnd || 0;
    }
    // map back to letters (A=1)
    function indexToLetters(index: number): string {
      if (index <= 0) return 'Z';
      let s = '';
      let n = index;
      while (n > 0) {
        const rem = (n - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    }
    const colL = indexToLetters(bestCol || 26);
    return `A1:${colL}${bestRow ? bestRow : ''}`;
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Load layout (draft in edit, published in view)
  useEffect(() => {
    let aborted = false;
    async function loadLayout() {
      try {
        const res = await fetch(`/api/dashboards/${slug}/layout`, { cache: 'no-store' });
        const data = await res.json();
        if (aborted) return;
        const next: any = {};
        for (const w of data.widgets || []) next[Number(w.widgetId)] = { x: w.x, y: w.y, width: w.width, height: w.height, zIndex: w.zIndex ?? 0 };
        // In view-mode (canEdit=false), ensure no overlaps by applying greedy separation
        setLayout(next);
        setLayoutLoaded(true);
        if (typeof window !== 'undefined') {
          (window as any).__currentLayout = next;
          (window as any).__currentSlug = slug;
        }
      } catch { setLayoutLoaded(true); }
    }
    loadLayout();
    const int = setInterval(() => { if (!isInteractingRef.current) loadLayout(); }, canEdit ? 4000 : 10000);
    return () => { aborted = true; clearInterval(int); };
  }, [slug, canEdit]);

  // Debounced save of draft layout
  const saveLayoutDebounced = useMemo(() => {
    let timer: any;
    return (next: Record<number, any>) => {
      setLayout(next);
      if (!canEdit) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const payload = { widgets: Object.entries(next).map(([id, r]) => ({ id: Number(id), ...r })) };
        await fetch(`/api/dashboards/${slug}/layout/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
      }, 400);
      try { if (typeof window !== 'undefined') { (window as any).__currentLayout = next; (window as any).__currentSlug = slug; } } catch {}
    };
  }, [slug, canEdit]);

  // Ensure non-overlap in view-mode at render time as well (in case of legacy layouts)
  const renderLayout = useMemo(() => {
    // For view-mode: display exactly published layout if available; fallback to safe separation only if overlapping is detected
    if (canEdit) return layout;
    try {
      const copy: any = { ...layout };
      // detect any overlap first
      const ids = visibleWidgets.map((w:any)=> Number(w.id));
      let hasOverlap = false;
      for (let i=0;i<ids.length;i++) {
        const a = copy[ids[i]] || defaultRect(i);
        for (let j=i+1;j<ids.length;j++) {
          const b = copy[ids[j]] || defaultRect(j);
          if (intersects(a,b)) { hasOverlap = true; break; }
        }
        if (hasOverlap) break;
      }
      return hasOverlap ? pushDownToResolve(copy, visibleWidgets as any) : layout;
    } catch { return layout; }
  }, [layout, canEdit, visibleWidgets]);

  function defaultRect(index: number): { x: number; y: number; width: number; height: number; zIndex: number } {
    const col = index % 2; const row = Math.floor(index / 2);
    const width = 560; const height = 320; const gap = 16;
    const x = col * (width + gap);
    const y = row * (height + gap);
    return { x, y, width, height, zIndex: 0 };
  }

  function intersects(a: { x:number;y:number;width:number;height:number }, b: { x:number;y:number;width:number;height:number }): boolean {
    return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
  }

  function willCollide(next: { x:number;y:number;width:number;height:number }, selfId: number, visibleWidgets: WidgetItem[], currentLayout: Record<number, { x:number;y:number;width:number;height:number;zIndex:number }>): boolean {
    for (let i = 0; i < visibleWidgets.length; i++) {
      const wid = Number((visibleWidgets[i] as any).id);
      if (wid === selfId) continue;
      const r = currentLayout[wid] || defaultRect(i);
      if (intersects(next, r)) return true;
    }
    return false;
  }

  const GAP = 16;

  function adjustActiveAvoidingOverlap(proposal: { x:number;y:number;width:number;height:number }, selfId: number, visible: WidgetItem[], currentLayout: Record<number, { x:number;y:number;width:number;height:number;zIndex:number }>) {
    // Push the active rect down until it does not intersect with any other visible rect
    let rect = { ...proposal };
    let changed = true;
    let guard = 0;
    while (changed && guard < 50) {
      changed = false; guard++;
      for (let i = 0; i < visible.length; i++) {
        const wid = Number((visible[i] as any).id);
        if (wid === selfId) continue;
        const other = currentLayout[wid] || defaultRect(i);
        if (intersects(rect, other)) {
          const newY = other.y + other.height + GAP;
          if (newY > rect.y) { rect.y = newY; changed = true; }
        }
      }
    }
    if (rect.x < 0) rect.x = 0; if (rect.y < 0) rect.y = 0;
    return rect;
  }

  function pushDownToResolve(nextLayout: Record<number, { x:number;y:number;width:number;height:number;zIndex:number }>, visible: WidgetItem[]) {
    // Greedy vertical separation: sort by y, then ensure no intersections by pushing down
    const order = visible.map((w:any, idx:number) => ({ id: Number(w.id), rect: nextLayout[Number(w.id)] || defaultRect(idx) }));
    // Iterate until stable or max 10 passes
    for (let pass = 0; pass < 10; pass++) {
      let changed = false;
      order.sort((a,b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
      for (let i = 0; i < order.length; i++) {
        for (let j = 0; j < order.length; j++) {
          if (i === j) continue;
          const A = order[i].rect; const B = order[j].rect;
          if (intersects(A, B)) {
            const newY = A.y + A.height + GAP;
            if (B.y < newY) { B.y = newY; changed = true; }
          }
        }
      }
      if (!changed) break;
    }
    // write back to layout
    for (const it of order) nextLayout[it.id] = { ...it.rect } as any;
    return nextLayout;
  }

  // Auto preview when key inputs change
  useEffect(() => {
    (async () => {
      if (!openAddWidget) return;
      if (!wDataSourceId || !wSheetTitle) return;
      try {
        setMiniLoading(true);
        const p = await fetch(`/api/data-sources/${wDataSourceId}/preview?sheet=${encodeURIComponent(wSheetTitle)}&range=${encodeURIComponent(wRange||'A1:Z')}`, { cache: 'no-store' });
        if (p.ok) {
          const jp = await p.json();
          const cols = (jp.columns || []) as { key: string; type?: string }[];
          setMiniCols(cols);
          // Infer defaults (quality-of-life)
          if (!wMapping.x) {
            const byName = cols.find(c=> /week|недел|date|дата|created/i.test(c.key)) || cols[0];
            if (byName) setWMapping((m)=> ({ ...m, x: byName.key }));
          }
          if (!wMapping.y) {
            const numeric = cols.find(c=> (c.type==='number') && /count|колич|sum|итог/i.test(c.key)) || cols.find(c=> c.type==='number');
            setWMapping((m)=> ({ ...m, y: numeric ? numeric.key : '__count', aggregate: numeric ? (m.aggregate||'sum') : 'count' }));
          }
          if (!wMapping.groupBy) {
            const cat = cols.find(c=> /source|источник|category|катег/i.test(c.key));
            if (cat) setWMapping((m)=> ({ ...m, groupBy: cat.key }));
          }
        }
        const r = await fetch(`/api/data-sources/${wDataSourceId}/read?sheet=${encodeURIComponent(wSheetTitle)}&range=${encodeURIComponent(wRange||'A1:Z')}&limit=5&offset=0`, { cache: 'no-store' });
        const jr = await r.json();
        if (r.ok) setMiniRows(jr.rows||[]);
      } finally {
        setMiniLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddWidget, wDataSourceId, wSheetTitle, wRange]);

  // When opening the widget modal, ensure we have up-to-date sources and prefer showing drafts if no published exist
  useEffect(() => {
    if (openAddWidget) {
      (async () => {
        await refresh();
        const hasPublished = allSources.some((s: any) => s.status === 'published');
        const hasDrafts = allSources.some((s: any) => s.status === 'draft' || s.status === undefined);
        if (!hasPublished && hasDrafts) setShowDraftsInWidget(true);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAddWidget]);

  async function handleAddSource() {
    setLoading1(true);
    setErr1(null);
    try {
      const payload: any = {
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
      setLinks((prev) => [{ id: created.id, dataSource: { id: created.dataSourceId, name: srcName || 'Google Sheet', type: 'google_sheets', status: 'draft' } }, ...prev]);
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
      setOpenAddSheets(false);
      setSrcName(''); setSrcUrl(''); setSheets([]); setSelected({}); setPdPreview(null);
      // Make newly added draft immediately available in widget modal without reload
      setShowDraftsInWidget(true);
    } catch (e: any) {
      setErr1(e.message || 'Ошибка');
    } finally {
      setLoading1(false);
    }
  }

  async function handleAddPipedrive() {
    setLoading1(true);
    setErr1(null);
    try {
      const payload: any = {
        type: 'pipedrive',
        name: srcName || undefined,
        entity: pdEntity,
        config: {
          pipelineId: pdPipelineId ? Number(pdPipelineId) : undefined,
          stageIds: pdStageIds ? pdStageIds.split(',').map(s=> Number(s.trim())).filter(n=>!Number.isNaN(n)) : undefined,
          ownerIds: pdOwnerIds ? pdOwnerIds.split(',').map(s=> Number(s.trim())).filter(n=>!Number.isNaN(n)) : undefined,
          dateField: pdDateField || undefined,
          dateFrom: pdDateFrom || undefined,
          dateTo: pdDateTo || undefined,
          fields: pdFields ? pdFields.split(',').map(s=> s.trim()) : undefined,
          savedFilterId: pdSavedFilterId ? Number(pdSavedFilterId) : undefined,
        }
      };
      const res2 = await fetch(`/api/dashboards/${slug}/data-sources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include'
      });
      if (!res2.ok) {
        const txt = await res2.text();
        let err = 'Не удалось сохранить источник';
        try { const j = JSON.parse(txt); if (j?.error) err = j.error; else if (j?.message) err = j.message; } catch {}
        throw new Error(err);
      }
      const created = await res2.json();
      setLinks((prev) => [{ id: created.id, dataSource: { id: created.dataSourceId, name: srcName || 'Pipedrive', type: 'pipedrive', status: 'draft' } }, ...prev]);
      try {
        const resL = await fetch(`/api/dashboards/${slug}/data-sources?ts=${Date.now()}`, { cache: 'no-store' });
        if (resL.ok) {
          const dataL = await resL.json(); setLinks(dataL.items || []);
        }
      } catch {}
      setOpenAddPipedrive(false);
      setSrcName(''); setPdPipelineId(''); setPdStageIds(''); setPdOwnerIds(''); setPdDateField(''); setPdDateFrom(''); setPdDateTo(''); setPdFields(''); setPdSavedFilterId(''); setPdPreview(null);
      setShowDraftsInWidget(true);
      setTab('draft');
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
      // Validate
      const errs: any = {};
      if (wType==='calendar') {
        // no required fields besides calendars (optional)
      } else if (wType==='line' || wType==='bar') {
        if (!wMapping.x) errs.x = 'Укажите ось X';
        if (!wMapping.y) errs.y = 'Укажите метрику Y';
      } else if (wType==='pie') {
        if (!wMapping.x && !wMapping.category) errs.x = 'Укажите категорию';
        if (!wMapping.y) errs.y = 'Укажите метрику Y или выберите «Счётчик строк»';
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length>0) { throw new Error('Заполните обязательные поля'); }
      const payload: any = (wType==='calendar') ? {
        type: 'calendar',
        title: wTitle,
        options: { calendars: Array.from(calSelected), mode: calMode }
      } : {
        type: wType,
        title: wTitle,
        dataSourceId: wDataSourceId,
        sheetTitle: wSheetTitle,
        range: wRange,
        options: { pageSize: 50 },
        mapping: wMapping
      };
      const res = await fetch(`/api/dashboards/${slug}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Не удалось создать виджет');
      const created = await res.json();
      setWidgets([{ id: created.id, title: created.title, type: created.type }, ...widgets]);
      await refresh();
      setOpenAddWidget(false);
      setWTitle('Новый виджет'); setWType('table'); setWRange('A1:Z'); setWSheetTitle(''); setSecret2(''); setWMapping({});
      setCalSelected(new Set()); setCalMode('day'); setCalPreview([]);
    } catch (e: any) {
      setErr2(e.message || 'Ошибка');
    } finally {
      setLoading2(false);
    }
  }

  // Load Pipedrive directories when opening the Pipedrive modal
  useEffect(() => {
    if (!openAddPipedrive) return;
    (async () => {
      try {
        const [pip, usr, flds, flt] = await Promise.all([
          fetch('/api/pipedrive/pipelines', { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }),
          fetch('/api/pipedrive/users', { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }),
          fetch(`/api/pipedrive/fields?entity=${pdEntity}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }),
          fetch(`/api/pipedrive/filters?entity=${pdEntity}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }),
        ]);
        setPdPipelines(pip.items || []);
        setPdOwners(usr.items || []);
        setPdFieldsList((flds.items || []).map((x: any) => ({ key: String(x.key ?? x.id), name: String(x.name ?? x.key) })));
        setPdFilters(flt.items || []);
        if (pdPipelineId) {
          const st = await fetch(`/api/pipedrive/stages?pipelineId=${encodeURIComponent(pdPipelineId)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] });
          setPdStagesAll(st.items || []);
        }
      } catch {}
    })();
  }, [openAddPipedrive, pdEntity, pdPipelineId]);

  // Refetch stages when pipeline changes (while modal open)
  useEffect(() => {
    if (!openAddPipedrive) return;
    (async () => {
      try {
        const st = await fetch(`/api/pipedrive/stages?pipelineId=${encodeURIComponent(pdPipelineId||'')}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] });
        setPdStagesAll(st.items || []);
      } catch {}
    })();
  }, [pdPipelineId, openAddPipedrive]);

  // server provides canEdit prop; do not rely on document here

  return (
    <>
      {canEdit ? (
        <div className="flex gap-2">
          <Button onClick={() => setOpenAddSheets(true)}>Добавить таблицу (Google Sheets)</Button>
          <Button onClick={() => setOpenAddPipedrive(true)} variant="secondary">Добавить источник Pipedrive</Button>
          <Button onClick={() => setOpenAddCalendar(true)} variant="secondary">Добавить Google Calendar</Button>
          <Button variant="secondary" onClick={() => setOpenAddWidget(true)}>Добавить виджет</Button>
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <button className={`px-2 py-1 rounded ${tab==='pub'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setTab('pub')}>Опубликованные</button>
          <button className={`px-2 py-1 rounded ${tab==='draft'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setTab('draft')}>Черновики</button>
          <button className={`px-2 py-1 rounded ${tab==='trash'?'bg-blue-600 text-white':'bg-gray-100'}`} onClick={()=>setTab('trash')}>Корзина</button>
        </div>
      ) : null}

      <div className="mt-3">
        {links.length === 0 ? (
          <div className="text-sm text-gray-500">Нет источников{canEdit ? ', нажмите «Добавить источник»' : ''}</div>
        ) : (
          <ul className="list-disc pl-6 space-y-1">
            {links
              .filter((l) => {
                const dsStatus = (l as any).dataSource?.status as string | undefined;
                const linkStatus = (l as any).status as string | undefined;
                const effective = linkStatus==='deleted' ? 'deleted' : (dsStatus ?? linkStatus ?? undefined);
                if (tab==='trash') return effective==='deleted';
                if (tab==='draft') return effective===undefined || effective==='draft';
                return effective==='published';
              })
              .map((l) => {
              const ds: any = (l as any).dataSource || {};
              const linkStatus: string | undefined = (l as any).status;
              const status: string | undefined = linkStatus==='deleted' ? 'deleted' : (ds.status ?? linkStatus ?? undefined);
              const titles: string[] = ((l as any).sheets || []).map((s: any) => s.title);
              const label = (() => {
                if ((ds.type || '') !== 'google_sheets') return ds.name || 'Источник';
                if (titles.length === 0) return `Таблица — ${ds.spreadsheetTitle || ds.name || ''}`.trim();
                if (titles.length === 1) return `Таблица — ${titles[0]}`;
                if (titles.length === 2) return `Таблица — ${titles[0]}, ${titles[1]}`;
                return `Таблица — ${titles[0]}, ${titles[1]} (+${titles.length - 2})`;
              })();
              return (
                <li key={l.id} className="flex items-center gap-2">
                  <span className="max-w-[48ch] truncate" title={label}>{label}</span>
                  {canEdit && status ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${status === 'published' ? 'bg-green-100 text-green-700' : status==='draft' ? 'bg-amber-100 text-amber-800' : 'bg-gray-300 text-gray-700'}`}>{status === 'published' ? 'Опубликован' : status==='draft'?'Черновик':'Удалён'}</span>
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
                  {canEdit && status!=='deleted' ? (
                    <>
                      {status==='draft' ? (
                        <button className="text-xs text-green-700" onClick={async ()=>{
                          await fetch(`/api/dashboards/${slug}/data-sources/${l.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }), credentials: 'include' });
                          await refresh();
                        }}>Опубликовать</button>
                      ) : status==='published' ? (
                        <button className="text-xs text-amber-700" onClick={async ()=>{
                          await fetch(`/api/dashboards/${slug}/data-sources/${l.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpublish' }), credentials: 'include' });
                          setTab('draft');
                          await refresh();
                        }}>В черновик</button>
                      ) : null}
                    </>
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
        <div className="text-sm font-medium mb-2 flex items-center gap-2">
          <span>Виджеты</span>
          {canEdit ? (
            <>
              <button className="text-xs underline" onClick={async ()=>{ const res = await fetch(`/api/dashboards/${slug}/layout/reset`, { method: 'POST', credentials: 'include' }); if (res.ok) {
                const d = await fetch(`/api/dashboards/${slug}/layout`, { cache: 'no-store' }).then(r=>r.json());
                const next:any={}; for (const w of d.widgets||[]) next[Number(w.widgetId)]={ x:w.x,y:w.y,width:w.width,height:w.height,zIndex:w.zIndex||0};
                setLayout(next);
              } }}>Reset</button>
              <button className="text-xs underline" onClick={async ()=>{ await fetch(`/api/dashboards/${slug}/layout/publish`, { method: 'POST', credentials: 'include' }); }}>Publish</button>
              <button className="text-xs underline" onClick={async ()=>{ const body = { snap: 16, resolveOverlaps: true, compact: true }; await fetch(`/api/dashboards/${slug}/layout/auto`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body), credentials: 'include' }); const d = await fetch(`/api/dashboards/${slug}/layout`, { cache: 'no-store' }).then(r=>r.json()); const next:any={}; for (const w of d.widgets||[]) next[Number(w.widgetId)]={ x:w.x,y:w.y,width:w.width,height:w.height,zIndex:w.zIndex||0}; setLayout(next); }}>Auto layout</button>
            </>
          ) : null}
        </div>
        {widgets.length === 0 ? (
          <div className="text-sm text-gray-500">Нет виджетов, создайте первый</div>
        ) : (
          <div className="relative border rounded" style={{ height: Math.max(containerHeight, 1200) }}>
            {visibleWidgets
              .map((w, idx) => {
                const base = layout[Number(w.id)] || defaultRect(idx);
                const r = canEdit ? base : (renderLayout[Number(w.id)] || base);
                const content = (
                  <div className="w-full h-full p-2 bg-white border rounded shadow-sm overflow-auto">
                    <div className="flex items-center justify-between mb-2 drag-handle cursor-move select-none">
                      <div className="text-sm">{w.title} ({w.type})</div>
                      {canEdit && (w as any).status!=='deleted' ? (
                        <div className="flex items-center gap-2">
                          {(w as any).status==='draft' ? (
                            <button className="text-xs text-green-700" onClick={async (e)=>{
                              e.stopPropagation();
                              await fetch(`/api/dashboards/${slug}/widgets/${w.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish' }), credentials: 'include' });
                              setWidgets((prev)=> prev.map((x:any)=> x.id===w.id ? { ...x, status: 'published' } : x));
                              await refresh();
                            }}>Опубликовать</button>
                          ) : null}
                          <button className="text-red-600 text-xs" onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('Переместить виджет в корзину?')) return;
                            await fetch(`/api/dashboards/${slug}/widgets/${w.id}`, { method: 'DELETE', credentials: 'include' });
                            setWidgets((prev) => prev.map((x: any) => x.id === w.id ? { ...x, status: 'deleted' } : x));
                            await refresh();
                          }}>Удалить</button>
                        </div>
                      ) : null}
                    </div>
                    {w.type === 'table' ? (
                      <TableWidgetPreview canEdit={canEdit} slug={slug} widget={w} dataSourceId={(w as any).config?.dataSourceId || 0} sheetTitle={(w as any).config?.sheetTitle || ''} range={(w as any).config?.range || 'A1:Z'} pageSize={(w as any).config?.options?.pageSize || 1000} />
                    ) : (w.type==='line' || w.type==='bar' || w.type==='pie') ? (
                      <ChartWidgetPreview type={w.type as any} config={(w as any).config} />
                    ) : w.type==='calendar' ? (
                      <CalendarWidgetPreview config={(w as any).config} />
                    ) : null}
                    {canEdit ? (
                      <div className="absolute right-2 top-2 text-[10px] bg-black/60 text-white px-1 rounded">{r.x},{r.y} · {r.width}×{r.height}</div>
                    ) : null}
                  </div>
                );
                if (!canEdit) {
                  return (
                    <div key={w.id} style={{ position:'absolute', left:r.x, top:r.y, width:r.width, height:r.height, zIndex:r.zIndex }}>
                      {content}
                    </div>
                  );
                }
                return (
                  <Rnd key={w.id}
                    size={{ width: r.width, height: r.height }}
                    position={{ x: r.x, y: r.y }}
                    bounds="parent"
                    enableResizing={{ top:true, right:true, bottom:true, left:true, topRight:true, bottomRight:true, bottomLeft:true, topLeft:true }}
                    minWidth={240}
                    minHeight={160}
                    dragHandleClassName="drag-handle"
                    onDragStart={()=>{ isInteractingRef.current = true; }}
                    onDrag={(e, d) => {
                      // live rearrange while dragging, without overlaps
                      let next = { ...layout } as any;
                      const proposal = { x: Math.max(0, d.x), y: Math.max(0, d.y), width: r.width, height: r.height };
                      const adjusted = willCollide(proposal, Number((w as any).id), visibleWidgets, next)
                        ? adjustActiveAvoidingOverlap(proposal, Number((w as any).id), visibleWidgets, next)
                        : proposal;
                      next[Number(w.id)] = { ...r, x: adjusted.x, y: adjusted.y };
                      setLayout(next);
                      try { if (typeof window !== 'undefined') (window as any).__currentLayout = next; } catch {}
                    }}
                    onResizeStart={()=>{ isInteractingRef.current = true; }}
                    onResize={(e, dir, ref, delta, pos) => {
                      // live rearrange while resizing, without overlaps
                      const width = ref.offsetWidth; const height = ref.offsetHeight;
                      let next = { ...layout } as any;
                      const proposal = { x: Math.max(0, pos.x), y: Math.max(0, pos.y), width, height };
                      const adjusted = willCollide(proposal, Number((w as any).id), visibleWidgets, next)
                        ? adjustActiveAvoidingOverlap(proposal, Number((w as any).id), visibleWidgets, next)
                        : proposal;
                      next[Number(w.id)] = { ...r, width: adjusted.width, height: adjusted.height, x: adjusted.x, y: adjusted.y };
                      setLayout(next);
                      try { if (typeof window !== 'undefined') (window as any).__currentLayout = next; } catch {}
                    }}
                    onDragStop={(e, d) => {
                      isInteractingRef.current = false;
                      const proposal = { x: Math.max(0, d.x), y: Math.max(0, d.y), width: r.width, height: r.height };
                      let next = { ...layout } as any;
                      const adjusted = willCollide(proposal, Number((w as any).id), visibleWidgets, next)
                        ? adjustActiveAvoidingOverlap(proposal, Number((w as any).id), visibleWidgets, next)
                        : proposal;
                      next[Number(w.id)] = { ...r, x: adjusted.x, y: adjusted.y } as any;
                      try { if (typeof window !== 'undefined') (window as any).__currentLayout = next; } catch {}
                      saveLayoutDebounced(next);
                    }}
                    onResizeStop={(e, dir, ref, delta, pos) => {
                      isInteractingRef.current = false;
                      const proposal = { x: Math.max(0, pos.x), y: Math.max(0, pos.y), width: ref.offsetWidth, height: ref.offsetHeight };
                      let next = { ...layout } as any;
                      const adjusted = willCollide(proposal, Number((w as any).id), visibleWidgets, next)
                        ? adjustActiveAvoidingOverlap(proposal, Number((w as any).id), visibleWidgets, next)
                        : proposal;
                      next[Number(w.id)] = { ...r, width: adjusted.width, height: adjusted.height, x: adjusted.x, y: adjusted.y } as any;
                      try { if (typeof window !== 'undefined') (window as any).__currentLayout = next; } catch {}
                      saveLayoutDebounced(next);
                    }}>
                    {content}
                  </Rnd>
                );
              })}
          </div>
        )}
      </div>
      <Modal open={canEdit && openAddSheets} onClose={() => setOpenAddSheets(false)} title="Добавить таблицу (Google Sheets)">
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
          {
            <div className="border rounded p-2 text-xs text-gray-600">
              <div className="font-medium text-gray-500 mb-1">Доступ сервисному аккаунту</div>
              <div>Чтобы приложение могло читать таблицу, добавьте этого пользователя в Google Sheets с правами «Редактор»:</div>
              <div className="mt-2 flex items-center gap-2">
                <Input readOnly value={serviceEmail} className="flex-1" />
                <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(serviceEmail); alert('Скопировано'); }}>Скопировать</Button>
                <button className="text-blue-600 underline" onClick={() => alert('1) В таблице нажмите «Поделиться»\n2) Вставьте адрес сервисного аккаунта\n3) Выберите «Редактор» → «Готово»')}>Как дать доступ?</button>
              </div>
            </div>
          }
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddSheets(false)}>Отмена</Button>
            <Button onClick={handleAddSource} disabled={loading1 || (!srcUrl || Object.keys(selected).length === 0)}>{loading1 ? (<><Spinner /> <span className="ml-2">Сохраняем…</span></>) : 'Сохранить'}</Button>
          </div>
          <div className="text-xs text-gray-500">Дайте доступ редактора сервисному аккаунту: переменная GOOGLE_SHEETS_CLIENT_EMAIL</div>
        </div>
      </Modal>

      <Modal open={canEdit && openAddCalendar} onClose={() => setOpenAddCalendar(false)} title="Добавить Google Calendar">
        <div className="space-y-3">
          <div className="border rounded p-2 text-xs bg-gray-50 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Период:</span>
              <label className="inline-flex items-center gap-1"><input type="radio" checked={calMode==='day'} onChange={()=> setCalMode('day')} /> День</label>
              <label className="inline-flex items-center gap-1"><input type="radio" checked={calMode==='week'} onChange={()=> setCalMode('week')} /> Неделя</label>
              <label className="inline-flex items-center gap-1"><input type="radio" checked={calMode==='month'} onChange={()=> setCalMode('month')} /> Месяц</label>
            </div>
            <div>
              <div className="mb-1">Люди (календарь)</div>
              <Input value={calQuery} onChange={(e)=> setCalQuery(e.target.value)} placeholder="Поиск по имени/email" />
              {calError ? <div className="text-[12px] text-red-700 mt-1">{calError}</div> : null}
              {calConfigChecked && (!hasClientId || !clientId) ? <div className="text-[12px] text-red-700 mt-1">Missing ENV GOOGLE_CALENDAR_CLIENT_ID</div> : null}
              <div className="mt-1 max-h-48 overflow-auto border rounded">
                <ul className="text-sm">
                  {[...STAFF_CALENDARS, ...calList]
                    .filter((c, idx, arr) => idx === arr.findIndex(x => (x.id||'').toLowerCase() === (c.id||'').toLowerCase()))
                    .filter(c=> (c.summary||c.id).toLowerCase().includes(calQuery.toLowerCase()))
                    .map(c=> {
                    const sel = calSelected.has(c.id);
                    return (
                      <li key={c.id} className={`px-2 py-1 flex items-center justify-between cursor-pointer ${sel?'bg-blue-50':'bg-white'}`} onClick={()=>{
                        const next = new Set(calSelected); if (sel) next.delete(c.id); else next.add(c.id); setCalSelected(next);
                      }}>
                        <span className="truncate" title={c.id}>{c.summary || c.id}</span>
                        <span className={`text-[11px] ml-2 ${sel?'text-blue-700':'text-gray-400'}`}>{sel?'выбрано':'выбрать'}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="font-medium">Превью (сегодня + 7 дней)</div>
              <button className="underline" onClick={async ()=>{
                try {
                  setCalLoading(true);
                  const ids = Array.from(calSelected).join(',');
                  const now = new Date();
                  const timeMin = now.toISOString();
                  const timeMax = new Date(now.getTime() + 7*24*3600*1000).toISOString();
                  const ev = await fetch(`/api/calendar/events?calendarId=${encodeURIComponent(ids)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { cache: 'no-store' });
                  const j = await ev.json();
                  if (ev.ok) setCalPreview(j.items||[]); else alert(j?.error||'Ошибка');
                } finally { setCalLoading(false); }
              }}>Обновить превью</button>
            </div>
            {calLoading ? <div className="text-gray-500">Загрузка…</div> : (
              <div className="space-y-1 max-h-56 overflow-auto">
                {calPreview.length===0 ? <div className="text-gray-500">Нет событий</div> : calPreview.map((e,i)=> (
                  <div key={i} className="border rounded p-1 bg-white">
                    <div className="text-[12px] text-gray-600">{new Date(e.start).toLocaleString('ru-RU')}</div>
                    <div className="text-sm">{e.summary || 'Без названия'}</div>
                    <div className="text-[12px] text-gray-500">{e.organizer || ''}</div>
                    {e.hangoutLink ? <a className="text-[12px] text-blue-600 underline" href={e.hangoutLink} target="_blank" rel="noreferrer">Ссылка</a> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddCalendar(false)}>Отмена</Button>
            <Button onClick={async ()=>{
              try {
                setLoading2(true);
                const payload = { type: 'calendar', title: 'Календарь', options: { calendars: Array.from(calSelected), mode: calMode } } as any;
                const res = await fetch(`/api/dashboards/${slug}/widgets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
                if (!res.ok) throw new Error('Не удалось создать календарь');
                await refresh();
                setTab('draft');
                setOpenAddCalendar(false);
                setCalSelected(new Set()); setCalPreview([]);
              } catch (e: any) { alert(e.message||'Ошибка'); } finally { setLoading2(false); }
            }}>Сохранить</Button>
          </div>
        </div>
      </Modal>

      <Modal open={openAddWidget} onClose={() => setOpenAddWidget(false)} title="Добавить виджет">
        <div className="space-y-3">
          <label className="block text-sm">Заголовок
            <Input value={wTitle} onChange={(e) => setWTitle(e.target.value)} />
          </label>
          <div className="text-xs text-gray-600">Тип</div>
          <select className="border rounded px-3 py-2 text-sm w-full" value={wType} onChange={(e)=> setWType(e.target.value as any)}>
            <option value="table">Таблица</option>
            <option value="line">Линейный график</option>
            <option value="bar">Столбчатая диаграмма</option>
            <option value="pie">Круговая диаграмма</option>
            <option value="calendar">Календарь</option>
          </select>
          {wType==='calendar' ? (
            <div className="border rounded p-2 text-xs bg-gray-50 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Период:</span>
                <label className="inline-flex items-center gap-1"><input type="radio" checked={calMode==='day'} onChange={()=> setCalMode('day')} /> День</label>
                <label className="inline-flex items-center gap-1"><input type="radio" checked={calMode==='week'} onChange={()=> setCalMode('week')} /> Неделя</label>
                <label className="inline-flex items-center gap-1"><input type="radio" checked={calMode==='month'} onChange={()=> setCalMode('month')} /> Месяц</label>
              </div>
              <div className="mt-2">
                <div className="mb-1">Люди (календарь)</div>
                <Input value={calQuery} onChange={(e)=> setCalQuery(e.target.value)} placeholder="Поиск по имени/email" />
                <div className="mt-1 flex gap-1 flex-wrap max-h-48 overflow-auto">
                  {calList.filter(c=> (c.summary||c.id).toLowerCase().includes(calQuery.toLowerCase())).map(c=> {
                    const sel = calSelected.has(c.id);
                    return (
                      <button key={c.id} type="button" title={c.id} className={`px-2 py-0.5 rounded border text-xs ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300'}`} onClick={()=>{
                        const next = new Set(calSelected); if (sel) next.delete(c.id); else next.add(c.id); setCalSelected(next);
                      }}>{c.summary || c.id}</button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Если нет доступа к какому-то календарю — события просто не подтянутся, будет подсказка.</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="font-medium">Превью (сегодня + 7 дней)</div>
                <button className="underline" onClick={async ()=>{
                  try {
                    setCalLoading(true);
                    if (calList.length===0) {
                      const r = await fetch('/api/calendar/calendars', { cache: 'no-store' });
                      if (r.ok) setCalList(await r.json());
                    }
                    const ids = Array.from(calSelected).join(',');
                    const now = new Date();
                    const timeMin = now.toISOString();
                    const timeMax = new Date(now.getTime() + 7*24*3600*1000).toISOString();
                    const ev = await fetch(`/api/calendar/events?calendarId=${encodeURIComponent(ids)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { cache: 'no-store' });
                    const j = await ev.json();
                    if (ev.ok) setCalPreview(j.items||[]); else alert(j?.error||'Ошибка');
                  } finally { setCalLoading(false); }
                }}>Обновить превью</button>
              </div>
              {calLoading ? <div className="text-gray-500">Загрузка…</div> : (
                <div className="space-y-1 max-h-56 overflow-auto">
                  {calPreview.length===0 ? <div className="text-gray-500">Нет событий</div> : calPreview.map((e,i)=> (
                    <div key={i} className="border rounded p-1 bg-white">
                      <div className="text-[12px] text-gray-600">{new Date(e.start).toLocaleString('ru-RU')}</div>
                      <div className="text-sm">{e.summary || 'Без названия'}</div>
                      <div className="text-[12px] text-gray-500">{e.organizer || ''}</div>
                      {e.hangoutLink ? <a className="text-[12px] text-blue-600 underline" href={e.hangoutLink} target="_blank" rel="noreferrer">Ссылка</a> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <label className="block text-sm">Источник
            <div className="flex items-center gap-2 mb-1 text-xs">
              <label className="inline-flex items-center gap-1"><input type="checkbox" checked={showDraftsInWidget} onChange={(e)=>setShowDraftsInWidget(e.target.checked)} /> Показывать черновики</label>
            </div>
            {wType!=='calendar' ? (
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
                    const link = (links as any[]).find((l:any)=> Number(l.dataSourceId) === Number(id));
                    const fromLink = (link?.sheets || []) as { title: string; range?: string }[];
                    const sheetsList = (fromLink.length ? fromLink : arr);
                    if (sheetsList.length === 1) {
                      const t = sheetsList[0].title;
                      setWSheetTitle(t);
                      const sameTitleRanges = sheetsList.filter(s=>s.title===t).map(s=>s.range);
                      setWRange(chooseMaxRange(sameTitleRanges.length? sameTitleRanges : [sheetsList[0].range]));
                    }
                  }
                } catch {}
              }
            }}>
              <option value="">— выберите источник —</option>
              {Array.from(new Map(allSources.filter((s:any)=> (showDraftsInWidget ? s.status!=='deleted' : s.status==='published')).sort((a:any,b:any)=> new Date(b.updatedAt||0).getTime() - new Date(a.updatedAt||0).getTime()).map((s:any)=>[s.id,s])).values()).map((s:any) => {
                const link = (links as any[]).find((l:any)=> Number(l.dataSourceId) === Number(s.id));
                const titles: string[] = (link?.sheets || []).map((x:any)=> x.title);
                const label = (() => {
                  if ((s.type||'') !== 'google_sheets') return s.name;
                  if (titles.length === 0) return `Таблица — ${s.spreadsheetTitle || s.name || ''}`.trim();
                  if (titles.length === 1) return `Таблица — ${titles[0]}`;
                  if (titles.length === 2) return `Таблица — ${titles[0]}, ${titles[1]}`;
                  return `Таблица — ${titles[0]}, ${titles[1]} (+${titles.length - 2})`;
                })();
                return (<option key={s.id} value={s.id}>{label}{s.status==='draft'?' — Draft':''}</option>);
              })}
            </select>
            ) : (
              <div className="text-xs text-gray-600">Календари выбираются выше (в настройках виджета)</div>
            )}
          </label>
          {wType!=='calendar' && wDataSourceId && ((sourceSheets[wDataSourceId]?.length || 0) > 0 || ((links as any[]).find((l:any)=> Number(l.dataSourceId)===Number(wDataSourceId))?.sheets?.length||0) > 0) ? (
            <label className="block text-sm">Лист
              <select className="border rounded px-3 py-2 text-sm w-full" value={wSheetTitle} onChange={(e)=>{
                const t = e.target.value; setWSheetTitle(t);
                const merged = (() => {
                  const fromLink = ((links as any[]).find((l:any)=> Number(l.dataSourceId)===Number(wDataSourceId))?.sheets)||[];
                  const fromFetch = (sourceSheets[wDataSourceId!]||[]);
                  if (fromFetch.length) return [...fromLink, ...fromFetch];
                  return fromLink;
                })() as { title: string; range?: string }[];
                const candidates = merged.filter(s=>s.title===t).map(s=>s.range);
                setWRange(chooseMaxRange(candidates.length? candidates : [merged.find(s=>s.title===t)?.range]));
              }}>
                <option value="">— выберите лист —</option>
                {(() => {
                  const fromLink = ((links as any[]).find((l:any)=> Number(l.dataSourceId)===Number(wDataSourceId))?.sheets)||[];
                  const fromFetch = (sourceSheets[wDataSourceId!]||[]);
                  const arr = (fromFetch.length ? [...fromLink, ...fromFetch] : fromLink) as { title: string; range?: string }[];
                  const seen = new Set<string>();
                  return arr.filter(s=> {
                    if (seen.has(s.title)) return false; seen.add(s.title); return true;
                  }).map(s => (<option key={s.title} value={s.title}>{s.title}</option>));
                })()}
              </select>
            </label>
          ) : null}
          <label className="block text-sm">Sheet title
            <Input value={wSheetTitle} onChange={(e) => setWSheetTitle(e.target.value)} placeholder="Лист1" />
          </label>
          <label className="block text-sm">Диапазон (Range)
            <Input value={wRange} onChange={(e) => setWRange(e.target.value)} placeholder="A1:Z" />
          </label>
          {wType!=='calendar' && wDataSourceId && wSheetTitle ? (
            <div className="border rounded p-2 text-xs bg-gray-50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">Превью данных (5 строк)</div>
                <button className="underline" onClick={async ()=>{
                  if (!wDataSourceId || !wSheetTitle) return;
                  try {
                    setMiniLoading(true);
                    const p = await fetch(`/api/data-sources/${wDataSourceId}/preview?sheet=${encodeURIComponent(wSheetTitle)}&range=${encodeURIComponent(wRange||'A1:Z')}`, { cache: 'no-store' });
                    if (p.ok) setMiniCols(((await p.json()).columns)||[]);
                    const r = await fetch(`/api/data-sources/${wDataSourceId}/read?sheet=${encodeURIComponent(wSheetTitle)}&range=${encodeURIComponent(wRange||'A1:Z')}&limit=5&offset=0`, { cache: 'no-store' });
                    const jr = await r.json();
                    if (r.ok) setMiniRows(jr.rows||[]);
                  } finally { setMiniLoading(false); }
                }}>Обновить превью</button>
              </div>
              {miniLoading ? <div className="text-gray-500">Загрузка…</div> : (
                miniCols.length ? (
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs table-fixed border-separate border-spacing-0">
                      <thead className="bg-white sticky top-0 z-10">
                        <tr>
                          {miniCols.map((c)=> (<th key={c.key} className="px-2 py-1 text-left border border-gray-200">{c.key}{c.type?` (${c.type})`:''}</th>))}
                        </tr>
                      </thead>
                      <tbody className="[&>tr:nth-child(odd)]:bg-gray-50">
                        {miniRows.map((r, i)=> (
                          <tr key={i} className="hover:bg-gray-100">
                            {miniCols.map((c, ci)=> (
                              <td key={c.key+ci} className="px-2 py-1 border border-gray-200 align-top break-words">{(r[ci]===null||r[ci]===undefined||String(r[ci])==='')? '—' : String(r[ci])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="text-gray-500">Нажмите «Обновить превью», чтобы увидеть колонки</div>
              )}
              <div>
                <button className="underline" onClick={async ()=>{
                  if (!wDataSourceId || !wSheetTitle) return;
                  // Наивная авто-оценка последней строки: читаем максимум 5000 строк и ищем последнюю непустую
                  const r = await fetch(`/api/data-sources/${wDataSourceId}/read?sheet=${encodeURIComponent(wSheetTitle)}&range=${encodeURIComponent('A1:Z')}&limit=5000&offset=0`, { cache: 'no-store' });
                  const jr = await r.json();
                  if (!r.ok) return alert(jr?.error||'Ошибка определения диапазона');
                  const rows = jr.rows||[];
                  let last = rows.length;
                  for (let i=rows.length-1;i>=0;i--){
                    if (Array.isArray(rows[i]) && rows[i].some((v:any)=> v!==null && v!==undefined && String(v)!=='')) { last = i+1; break; }
                  }
                  setWRange(`A1:Z${last+1}`);
                  alert('Диапазон обновлён');
                }}>Определить заголовки/диапазон</button>
              </div>
            </div>
          ) : null}
          {wType !== 'table' && wType!=='calendar' ? (
            <div className="border rounded p-2 text-xs bg-gray-50 space-y-2">
              <div className="font-medium">Поля графика</div>
              <label className="block">Ось X (категория/дата)
                <select className="border rounded px-2 py-1 w-full" value={wMapping.x || ''} onChange={(e)=> setWMapping({ ...wMapping, x: e.target.value })}>
                  <option value="">— выберите колонку —</option>
                  {miniCols.map((c)=> (<option key={c.key} value={c.key}>{c.key}</option>))}
                </select>
                <div className="text-[11px] text-gray-500 mt-0.5">Выберите категорию или дату для группировки данных</div>
                {fieldErrors.x ? <div className="text-[11px] text-red-600 mt-0.5">{fieldErrors.x}</div> : null}
              </label>
              {wType!=='pie' ? (
                <label className="block">Ось Y (метрика)
                  <select className="border rounded px-2 py-1 w-full" value={wMapping.y || ''} onChange={(e)=> setWMapping({ ...wMapping, y: e.target.value })}>
                    <option value="">— выберите числовую колонку —</option>
                    {miniCols.filter((c)=> (c.type==='number')).map((c)=> (<option key={c.key} value={c.key}>{c.key}</option>))}
                    <option value="__count">Счётчик строк</option>
                  </select>
                  <div className="text-[11px] text-gray-500 mt-0.5">Выберите числовое поле для отображения на графике</div>
                  {fieldErrors.y ? <div className="text-[11px] text-red-600 mt-0.5">{fieldErrors.y}</div> : null}
                </label>
              ) : (
                <label className="block">Категория (для круговой)
                  <select className="border rounded px-2 py-1 w-full" value={wMapping.category || ''} onChange={(e)=> setWMapping({ ...wMapping, category: e.target.value })}>
                    <option value="">— выберите колонку —</option>
                    {miniCols.filter((c)=> (c.type!=='number')).map((c)=> (<option key={c.key} value={c.key}>{c.key}</option>))}
                  </select>
                </label>
              )}
              <label className="block">Серии (Group by)
                <select className="border rounded px-2 py-1 w-full" value={wMapping.groupBy || ''} onChange={(e)=> setWMapping({ ...wMapping, groupBy: e.target.value })}>
                  <option value="">— без группировки —</option>
                  {miniCols.filter((c)=> (c.type!=='number')).map((c)=> (<option key={c.key} value={c.key}>{c.key}</option>))}
                </select>
                <div className="text-[11px] text-gray-500 mt-0.5">Разделите данные по этому полю (например: Источник = Gmail, Tg)</div>
              </label>
              <label className="block">Агрегация
                <select className="border rounded px-2 py-1" value={wMapping.aggregate || 'count'} onChange={(e)=> setWMapping({ ...wMapping, aggregate: e.target.value as any })}>
                  <option value="count">Счётчик строк</option>
                  {(!wMapping.y || wMapping.y==='__count') ? null : (<>
                    <option value="sum">Сумма</option>
                    <option value="avg">Среднее</option>
                    <option value="min">Мин</option>
                    <option value="max">Макс</option>
                  </>)}
                </select>
                <div className="text-[11px] text-gray-500 mt-0.5">Выберите метод обработки чисел (сумма, количество и т.д.)</div>
              </label>
              <div className="text-[11px] text-gray-500">X — категория/ось времени; Y — числовая метрика; Серии — разбивка по ещё одному полю. Если нет числовых колонок, используйте «Счётчик строк».</div>
            </div>
          ) : null}
          {/* Admin Secret removed for UI operations */}
          {err2 ? <div className="text-sm text-red-600">{err2}</div> : null}
          <div className="flex justify-end gap-2 sticky bottom-0 bg-white pt-2">
            <Button variant="secondary" onClick={() => setOpenAddWidget(false)}>Отмена</Button>
            <Button onClick={handleAddWidget} disabled={loading2 || !wTitle || !wDataSourceId || !wSheetTitle}>{loading2 ? 'Сохранение…' : 'Сохранить'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={canEdit && openAddPipedrive} onClose={() => setOpenAddPipedrive(false)} title="Добавить источник Pipedrive">
        <div className="space-y-3">
          <label className="block text-sm">Name
            <Input value={srcName} onChange={(e) => setSrcName(e.target.value)} placeholder="Pipedrive Deals" />
          </label>
          <div className="border rounded p-2 text-xs bg-gray-50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm col-span-2">Сущность
                <select className="border rounded px-2 py-1 w-full" value={pdEntity} onChange={async (e)=> {
                  const val = e.target.value as any; setPdEntity(val);
                  try {
                    const [fRes, fltRes] = await Promise.all([
                      fetch(`/api/pipedrive/fields?entity=${val}`, { cache: 'no-store' }),
                      fetch(`/api/pipedrive/filters?entity=${val}`, { cache: 'no-store' }),
                    ]);
                    if (fRes.ok) { const j = await fRes.json(); setPdFieldsList((j.items||[]).map((x:any)=> ({ key: String(x.key ?? x.id), name: String(x.name ?? x.key) }))); }
                    if (fltRes.ok) { const j2 = await fltRes.json(); setPdFilters(j2.items||[]); }
                  } catch {}
                }}>
                  <option value="deals">Сделки</option>
                  <option value="persons">Контакты</option>
                  <option value="organizations">Организации</option>
                  <option value="activities">Активности</option>
                </select>
              </label>
              <label className="block text-sm">Воронка
                <select className="border rounded px-2 py-1 w-full" value={pdPipelineId} onChange={(e)=> setPdPipelineId(e.target.value)}>
                  <option value="">— выберите воронку —</option>
                  {pdPipelines.map((p)=> (<option key={p.id} value={String(p.id)}>{p.name}</option>))}
                </select>
              </label>
              <div className="block text-sm">
                <div className="mb-1">Этапы</div>
                <div className="flex gap-1 flex-wrap">
                  {pdStagesAll.filter(s=> !pdPipelineId || String(s.pipeline_id)===String(pdPipelineId)).map((s)=> {
                    const sel = (pdStageIds?pdStageIds.split(','):[]).includes(String(s.id));
                    return (
                      <button key={s.id} type="button" className={`px-2 py-0.5 rounded border text-xs ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300'}`} onClick={()=>{
                        const cur = new Set(pdStageIds?pdStageIds.split(','):[]);
                        if (cur.has(String(s.id))) cur.delete(String(s.id)); else cur.add(String(s.id));
                        setPdStageIds(Array.from(cur).join(','));
                      }}>{s.name}</button>
                    );
                  })}
                </div>
              </div>
              <div className="block text-sm">
                <div className="mb-1">Владельцы</div>
                <Input value={pdOwnerQuery} onChange={(e)=> setPdOwnerQuery(e.target.value)} placeholder="Поиск владельца" />
                <div className="mt-1 flex gap-1 flex-wrap max-h-28 overflow-auto">
                  {pdOwners.filter(u=> (u.name||'').toLowerCase().includes(pdOwnerQuery.toLowerCase())).map((u)=> {
                    const cur = new Set(pdOwnerIds?pdOwnerIds.split(','):[]);
                    const sel = cur.has(String(u.id));
                    return (
                      <button key={u.id} type="button" className={`px-2 py-0.5 rounded border text-xs ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300'}`} onClick={()=>{
                        if (sel) cur.delete(String(u.id)); else cur.add(String(u.id));
                        setPdOwnerIds(Array.from(cur).join(','));
                      }}>{u.name}</button>
                    );
                  })}
                </div>
              </div>
              <div className="block text-sm col-span-2">
                <div className="mb-1">Поле даты</div>
                <Input value={pdFieldQuery} onChange={(e)=> setPdFieldQuery(e.target.value)} placeholder="Поиск поля" />
                <select className="mt-1 border rounded px-2 py-1 w-full" value={pdDateField} onChange={(e)=> setPdDateField(e.target.value)}>
                  <option value="">— выбрать —</option>
                  {pdFieldsList.filter(f=> (f.name||f.key).toLowerCase().includes(pdFieldQuery.toLowerCase())).map((f)=> (<option key={f.key} value={f.key}>{f.name}</option>))}
                </select>
              </div>
              <label className="block text-sm">Дата от
                <input type="date" className="border rounded px-2 py-1 w-full" value={pdDateFrom} onChange={(e)=> setPdDateFrom(e.target.value)} />
              </label>
              <label className="block text-sm">Дата до
                <input type="date" className="border rounded px-2 py-1 w-full" value={pdDateTo} onChange={(e)=> setPdDateTo(e.target.value)} />
              </label>
              <label className="block text-sm">Saved Filter
                <select className="border rounded px-2 py-1 w-full" value={pdSavedFilterId} onChange={(e)=> setPdSavedFilterId(e.target.value)}>
                  <option value="">— не использовать —</option>
                  {pdFilters.map((f)=> (<option key={f.id} value={String(f.id)}>{f.name}</option>))}
                </select>
              </label>
              <div className="block text-sm col-span-2">
                <div className="mb-1">Поля (для выборки/отображения)</div>
                <Input value={pdFieldQuery} onChange={(e)=> setPdFieldQuery(e.target.value)} placeholder="Поиск поля" />
                <div className="mt-1 flex gap-1 flex-wrap max-h-28 overflow-auto">
                  {pdFieldsList.filter(f=> (f.name||f.key).toLowerCase().includes(pdFieldQuery.toLowerCase())).map((f)=> {
                    const sel = pdFieldsSel.has(f.key);
                    return (
                      <button key={f.key} type="button" className={`px-2 py-0.5 rounded border text-xs ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300'}`} onClick={()=>{
                        const next = new Set(pdFieldsSel);
                        if (sel) next.delete(f.key); else next.add(f.key);
                        setPdFieldsSel(next);
                        setPdFields(Array.from(next).join(','));
                      }}>{f.name}</button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Выбрано: {Array.from(pdFieldsSel).length}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm">Предпросмотр (5 строк)</div>
              <button className="underline" onClick={async ()=>{
                try {
                  const qs = new URLSearchParams({ entity: pdEntity, limit: '5' });
                  if (pdPipelineId) qs.set('pipelineId', pdPipelineId);
                  if (pdStageIds) qs.set('stageIds', pdStageIds);
                  if (pdOwnerIds) qs.set('ownerIds', pdOwnerIds);
                  if (pdDateField) qs.set('dateField', pdDateField);
                  if (pdDateFrom) qs.set('dateFrom', pdDateFrom);
                  if (pdDateTo) qs.set('dateTo', pdDateTo);
                  if (pdFields) qs.set('fields', JSON.stringify(pdFields.split(',').map(s=> s.trim())));
                  if (pdSavedFilterId) qs.set('savedFilterId', pdSavedFilterId);
                  const r = await fetch(`/api/pipedrive/preview?${qs.toString()}`, { cache: 'no-store' });
                  const j = await r.json();
                  if (!r.ok) throw new Error(j?.error||'Ошибка превью');
                  setPdPreview(j);
                } catch (e:any) { alert(e.message||'Ошибка превью'); }
              }}>Обновить превью</button>
            </div>
            {pdPreview ? (
              <div className="overflow-auto">
                <table className="min-w-full text-xs table-fixed border-separate border-spacing-0">
                  <thead className="bg-white sticky top-0 z-10">
                    <tr>
                      {pdPreview.columns.map((c)=> (<th key={c.key} className="px-2 py-1 text-left border border-gray-200">{c.key}{c.type?` (${c.type})`:''}</th>))}
                    </tr>
                  </thead>
                  <tbody className="[&>tr:nth-child(odd)]:bg-gray-50">
                    {(pdPreview.sample||[]).map((row:any, i:number)=> (
                      <tr key={i} className="hover:bg-gray-100">
                        {pdPreview.columns.map((c)=> (<td key={c.key} className="px-2 py-1 border border-gray-200 align-top break-words">{String(row?.[c.key] ?? '—')}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-gray-500">Нажмите «Обновить превью», чтобы увидеть колонки</div>}
          </div>
          {err1 ? (<div className="text-sm text-red-600">{err1}</div>) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenAddPipedrive(false)}>Отмена</Button>
            <Button onClick={handleAddPipedrive} disabled={loading1}>{loading1 ? (<> <Spinner /> <span className="ml-2">Сохраняем…</span></>) : 'Сохранить'}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ChartWidgetPreview({ type, config }: { type: 'line'|'bar'|'pie'; config: any }) {
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        const dsId = config?.dataSourceId; const sheet = config?.sheetTitle; const range = config?.range || 'A1:Z';
        if (!dsId || !sheet) return;
        const res = await fetch(`/api/data-sources/${dsId}/read?sheet=${encodeURIComponent(sheet)}&range=${encodeURIComponent(range)}&limit=5000&offset=0`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'Ошибка');
        const rows = j.rows || [];
        const columns = (j.columns || []).map((x: any) => String(x));
        const idx = (k: string) => Math.max(0, columns.indexOf(k));
        const xKey = config?.mapping?.x; const yKey = config?.mapping?.y; const catKey = config?.mapping?.category; const groupBy = config?.mapping?.groupBy; const agg = config?.mapping?.aggregate || 'count';
        const xi = xKey ? idx(xKey) : 0; const yi = yKey ? idx(yKey) : 1; const ci = catKey ? idx(catKey) : 0; const gi = groupBy ? idx(groupBy) : -1;
        const map = new Map<string, number>();
        const list: any[] = [];
        for (const r of rows) {
          const x = String(r[xi] ?? '');
          const g = gi >= 0 ? String(r[gi] ?? '') : '';
          const key = x + '||' + g;
          const val = Number(String(r[yi] ?? '0').replace(',', '.')) || 0;
          if (!map.has(key)) map.set(key, agg==='count' ? 1 : val);
          else map.set(key, agg==='count' ? (map.get(key)! + 1) : (agg==='sum' ? map.get(key)! + val : map.get(key)!));
        }
        // materialize
        const groups = new Map<string, any>();
        for (const [key, v] of map.entries()) {
          const [x, g] = key.split('||');
          const obj = groups.get(x) || { x };
          const seriesName = g || (yKey || 'value');
          obj[seriesName] = v;
          groups.set(x, obj);
        }
        setData(Array.from(groups.values()));
      } catch (e: any) {
        setError(e.message || 'Ошибка');
      }
    })();
  }, [type, JSON.stringify(config || {})]);
  if (error) return <div className="text-xs text-red-600">{error}</div>;
  if (!data.length) return <div className="text-xs text-gray-500">Нет данных</div>;
  const seriesKeys = Object.keys(data[0]).filter((k) => k !== 'x');
  const colors = ['#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed'];
  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        {type === 'line' ? (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" /><YAxis /><Tooltip /><Legend />
            {seriesKeys.map((k, i) => (<Line key={k} type="monotone" dataKey={k} stroke={colors[i%colors.length]} dot={false} />))}
          </LineChart>
        ) : type === 'bar' ? (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" /><YAxis /><Tooltip /><Legend />
            {seriesKeys.map((k, i) => (<Bar key={k} dataKey={k} fill={colors[i%colors.length]} />))}
          </BarChart>
        ) : (
          <PieChart>
            <Tooltip /><Legend />
            <Pie data={seriesKeys.length? data.map(d=> ({ name: d.x, value: Number(d[seriesKeys[0]]||0) })) : []} dataKey="value" nameKey="name" outerRadius={80} label>
              {data.map((_, i) => (<Cell key={i} fill={colors[i%colors.length]} />))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

