export function serializeJsonSafe<T = unknown>(input: T): any {
  return deepConvert(input);
}

function deepConvert(value: any): any {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'bigint') return Number(value);
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => deepConvert(v));
  if (t === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepConvert(v);
    return out;
  }
  return value;
}


