import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;
let cachedKey = '';

export function getServerSupabase(): SupabaseClient {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceKey) {
    throw new Error('Configurazione server Supabase mancante (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).');
  }

  const key = `${url}|${serviceKey}`;
  if (!adminClient || cachedKey !== key) {
    adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedKey = key;
  }

  return adminClient;
}

function stripMissingColumn(
  payload: Record<string, any> | Array<Record<string, any>>,
  colName: string
): boolean {
  let removed = false;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (item && Object.prototype.hasOwnProperty.call(item, colName)) {
        delete item[colName];
        removed = true;
      }
    }
  } else if (payload && Object.prototype.hasOwnProperty.call(payload, colName)) {
    delete payload[colName];
    removed = true;
  }
  return removed;
}

export async function safeServerUpsert(
  supabase: SupabaseClient,
  table: string,
  payload: Record<string, any> | Array<Record<string, any>>
): Promise<{ ok: boolean; error?: string }> {
  const currentPayload = Array.isArray(payload)
    ? payload.map(item => ({ ...item }))
    : { ...payload };

  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await (supabase.from(table) as any).upsert(currentPayload);
    if (!res?.error) {
      return { ok: true };
    }

    if (res.error.code === 'PGRST204') {
      const match = (res.error.message || '').match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) {
        const stripped = stripMissingColumn(currentPayload, match[1]);
        if (stripped) {
          console.warn(`Server upsert: column '${match[1]}' missing on '${table}', retrying.`);
          continue;
        }
      }
    }

    return { ok: false, error: res.error.message || `Errore salvataggio su ${table}` };
  }

  return { ok: false, error: `Troppi tentativi di compatibilità schema su ${table}` };
}

export async function safeServerDelete(
  supabase: SupabaseClient,
  table: string,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await (supabase.from(table) as any).delete().eq('id', id);
  if (res?.error) {
    return { ok: false, error: res.error.message || `Errore eliminazione su ${table}` };
  }
  return { ok: true };
}

export async function fetchAllServerRows<T>(
  supabase: SupabaseClient,
  table: string,
  orderCol?: string,
  ascending: boolean = false
): Promise<{ rows: T[]; ok: boolean }> {
  const allRows: T[] = [];
  const pageSize = 1000;
  let from = 0;

  try {
    while (true) {
      const to = from + pageSize - 1;
      let query = (supabase.from(table) as any).select('*').range(from, to);
      if (orderCol) {
        query = query.order(orderCol, { ascending });
      }
      const { data, error } = await query;
      if (error) {
        console.warn(`Server fetch error on ${table} (${from}-${to}):`, error);
        return { rows: allRows, ok: false };
      }
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return { rows: allRows, ok: true };
  } catch (err) {
    console.warn(`Server fetch exception on ${table}:`, err);
    return { rows: allRows, ok: false };
  }
}
