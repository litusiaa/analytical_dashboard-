import { setTimeout as delay } from 'timers/promises';

type PipedriveEntity = 'deals' | 'persons' | 'organizations' | 'activities';

function getEnv() {
  const baseUrl = process.env.PIPEDRIVE_BASE_URL || '';
  const token = process.env.PIPEDRIVE_API_TOKEN || '';
  const timeoutMs = Number(process.env.PIPEDRIVE_REQUEST_TIMEOUT_MS || '30000');
  if (!baseUrl || !token) throw new Error('Pipedrive is not configured. Set PIPEDRIVE_BASE_URL and PIPEDRIVE_API_TOKEN');
  return { baseUrl: baseUrl.replace(/\/$/, ''), token, timeoutMs };
}

async function request(path: string, params: Record<string, any> = {}, { retries = 2 }: { retries?: number } = {}) {
  const { baseUrl, token, timeoutMs } = getEnv();
  const u = new URL(baseUrl + path);
  u.searchParams.set('api_token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) u.searchParams.set(k, v.join(','));
    else u.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(u.toString(), { headers: { Accept: 'application/json' }, signal: controller.signal } as any);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      const err = new Error(json?.error || json?.message || `Pipedrive error ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    return json;
  } catch (e) {
    if (retries > 0) { await delay(500); return request(path, params, { retries: retries - 1 }); }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

export async function pipedriveList(entity: PipedriveEntity, params: Record<string, any> = {}) {
  // Basic list with pagination; return { items, additional }
  const json = await request(`/${entity}`, params);
  const items = Array.isArray(json?.data) ? json.data : (json?.data?.items || []);
  const additional = json?.additional_data || {};
  return { items, additional };
}

export function inferType(value: any): 'number'|'date'|'boolean'|'string' {
  if (value === null || value === undefined || value === '') return 'string';
  if (typeof value === 'number') return 'number';
  const s = String(value).trim();
  if (/^(true|false)$/i.test(s)) return 'boolean';
  const n = Number(s.replace(',', '.'));
  if (!Number.isNaN(n) && (/^-?\d+(?:[\.,]\d+)?$/.test(s))) return 'number';
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return 'date';
  return 'string';
}

export function buildColumnsFromItems(items: any[]): { key: string; type: string }[] {
  const first = items?.[0] || {};
  const keys = Object.keys(first);
  const cols: { key: string; type: string }[] = [];
  for (const k of keys) {
    let t = 'string';
    for (let i = 0; i < Math.min(items.length, 50); i++) {
      const vt = inferType(items[i]?.[k]);
      if (vt !== 'string') { t = vt; break; }
    }
    cols.push({ key: k, type: t });
  }
  return cols;
}

export async function pipedrivePreview(entity: PipedriveEntity, config: Record<string, any> = {}, limit = 5) {
  const params: Record<string, any> = { limit };
  if (config?.savedFilterId) params.filter_id = config.savedFilterId;
  if (config?.pipelineId) params.pipeline_id = config.pipelineId;
  if (config?.stageIds && Array.isArray(config.stageIds)) params.stage_id = config.stageIds.join(',');
  if (config?.ownerIds && Array.isArray(config.ownerIds)) params.user_id = config.ownerIds.join(',');
  // date range is entity-specific; we include generic since not all endpoints support
  if (config?.dateFrom && config?.dateTo && config?.dateField) {
    params[config.dateField] = `${config.dateFrom},${config.dateTo}`;
  }
  const { items } = await pipedriveList(entity, params);
  const columns = buildColumnsFromItems(items);
  const sample = items.slice(0, limit);
  return { columns, sample };
}

import { z } from 'zod';

const BASE_URL = process.env.PIPEDRIVE_BASE_URL || 'https://api.pipedrive.com/v1';
const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;

function assertAuth() {
  if (!API_TOKEN) {
    throw new Error('Pipedrive token not configured');
  }
}

async function pdFetch<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  assertAuth();
  const query = new URLSearchParams();
  query.set('api_token', API_TOKEN as string);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) query.set(k, String(v));
    }
  }
  const url = `${BASE_URL}${path}?${query.toString()}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Pipedrive error ${res.status}`);
  }
  const data = await res.json();
  return data.data as T;
}

export type PdUser = { id: number; name: string; email?: string | null };
export type PdPipeline = { id: number; name: string };
export type PdStage = { id: number; name: string; pipeline_id: number; order_nr?: number };
export type PdDeal = {
  id: number;
  title: string;
  org_id?: number | null;
  org_name?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  pipeline_id?: number | null;
  stage_id?: number | null;
  status: string;
  add_time?: string | null;
  update_time?: string | null;
  won_time?: string | null;
  expected_close_date?: string | null;
  person_id?: number | null;
};

export async function fetchUsers(): Promise<PdUser[]> {
  return pdFetch<PdUser[]>('/users');
}

export async function fetchPipelines(): Promise<PdPipeline[]> {
  return pdFetch<PdPipeline[]>('/pipelines');
}

export async function fetchStages(): Promise<PdStage[]> {
  return pdFetch<PdStage[]>('/stages');
}

export async function fetchDealsByOwner(ownerName: string): Promise<PdDeal[]> {
  // Pipedrive v1 does not support ownerName filter directly; fetch and filter client-side as MVP.
  const deals = await pdFetch<PdDeal[]>('/deals', { status: 'all_not_deleted', start: 0, limit: 500 });
  return deals.filter((d) => (d.owner_name || '').trim() === ownerName.trim());
}

// Stage history (flow API) – MVP: attempt call; if not available, TODO webhook fallback (not implemented)
type StageChange = { deal_id: number; stage_id: number; time: string; pipeline_id?: number | null; expected_close_date?: string | null };

export async function fetchStageHistory(dealId: number): Promise<StageChange[]> {
  try {
    const flow = await pdFetch<any[]>(`/deals/${dealId}/flow`);
    // Normalize minimal fields
    return (flow || [])
      .filter((e) => e.to_stage_id || e.stage_id)
      .map((e) => ({
        deal_id: dealId,
        stage_id: e.to_stage_id ?? e.stage_id,
        time: e.time || e.add_time || e.update_time || new Date().toISOString(),
        pipeline_id: e.pipeline_id ?? e.to_pipeline_id ?? null,
        expected_close_date: e.expected_close_date ?? null,
      }));
  } catch (e) {
    // TODO: webhook fallback (not implemented in MVP)
    return [];
  }
}

