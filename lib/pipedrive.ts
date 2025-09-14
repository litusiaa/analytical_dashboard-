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

