import { createClient } from '@supabase/supabase-js';
import { Location, Client, Appointment, WeddingService, Expense, AppSettings } from '@/types';

function getSupabaseConfig() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, key: envKey };
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('fede_settings');
      if (stored) {
        const parsed = JSON.parse(stored) as AppSettings;
        if (parsed.supabase_url && parsed.supabase_anon_key) {
          return { url: parsed.supabase_url, key: parsed.supabase_anon_key };
        }
      }
    } catch {
      // ignore
    }
  }

  return { url: '', key: '' };
}

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  // Clean url if user included /rest/v1
  const cleanUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

  if (!supabaseInstance) {
    supabaseInstance = createClient(cleanUrl, key);
  }
  return supabaseInstance;
}

async function fetchAllRows<T>(
  supabase: any,
  table: string,
  orderCol?: string
): Promise<T[]> {
  const allRows: T[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    let query = supabase.from(table).select('*').range(from, to);
    if (orderCol) {
      query = query.order(orderCol, { ascending: false });
    }
    const { data, error } = await query;
    if (error) {
      console.warn(`Error fetching ${table} range ${from}-${to}:`, error);
      break;
    }
    if (!data || data.length === 0) {
      break;
    }
    allRows.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return allRows;
}

export const CloudSync = {
  async fetchAll() {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const [locations, clients, appointments, weddings, expenses] = await Promise.all([
        supabase.from('locations').select('*').then((r: any) => (r.data as Location[]) || []),
        fetchAllRows<Client>(supabase, 'clients', 'created_at'),
        fetchAllRows<Appointment>(supabase, 'appointments', 'appointment_date'),
        fetchAllRows<WeddingService>(supabase, 'wedding_services', 'wedding_date'),
        fetchAllRows<Expense>(supabase, 'expenses', 'date'),
      ]);

      return {
        locations,
        clients,
        appointments,
        weddings,
        expenses,
      };
    } catch (err) {
      console.warn('CloudSync fetchAll failed, offline or error:', err);
      return null;
    }
  },

  async upsertClient(client: Client) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('clients') as any).upsert(client);
    } catch (e) {
      console.error('upsertClient error:', e);
    }
  },

  async deleteClient(id: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('clients') as any).delete().eq('id', id);
    } catch (e) {
      console.error('deleteClient error:', e);
    }
  },

  async upsertAppointment(app: Appointment) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const res = await (supabase.from('appointments') as any).upsert(app);
      if (res && res.error && res.error.code === 'PGRST204') {
        // Fallback without new columns if user hasn't run the alter table script yet
        const safeApp: any = { ...app };
        delete safeApp.end_time;
        delete safeApp.touch_up_time;
        delete safeApp.linked_appointment_id;
        delete safeApp.is_touch_up;
        await (supabase.from('appointments') as any).upsert(safeApp);
      }
    } catch (e) {
      console.error('upsertAppointment error:', e);
    }
  },

  async deleteAppointment(id: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('appointments') as any).delete().eq('id', id);
    } catch (e) {
      console.error('deleteAppointment error:', e);
    }
  },

  async upsertWedding(wedding: WeddingService) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('wedding_services') as any).upsert(wedding);
    } catch (e) {
      console.error('upsertWedding error:', e);
    }
  },

  async deleteWedding(id: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('wedding_services') as any).delete().eq('id', id);
    } catch (e) {
      console.error('deleteWedding error:', e);
    }
  },

  async upsertExpense(expense: Expense) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('expenses') as any).upsert(expense);
    } catch (e) {
      console.error('upsertExpense error:', e);
    }
  },

  async deleteExpense(id: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('expenses') as any).delete().eq('id', id);
    } catch (e) {
      console.error('deleteExpense error:', e);
    }
  },

  async upsertLocation(loc: Location) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('locations') as any).upsert(loc);
    } catch (e) {
      console.error('upsertLocation error:', e);
    }
  },

  async deleteLocation(id: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('locations') as any).delete().eq('id', id);
    } catch (e) {
      console.error('deleteLocation error:', e);
    }
  }
};

