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

export const CloudSync = {
  async fetchAll() {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const [locsRes, clientsRes, appsRes, weddingsRes, expensesRes] = await Promise.all([
        supabase.from('locations').select('*'),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').order('appointment_date', { ascending: false }),
        supabase.from('wedding_services').select('*').order('wedding_date', { ascending: false }),
        supabase.from('expenses').select('*').order('date', { ascending: false }),
      ]);

      return {
        locations: locsRes.data as Location[] | null,
        clients: clientsRes.data as Client[] | null,
        appointments: appsRes.data as Appointment[] | null,
        weddings: weddingsRes.data as WeddingService[] | null,
        expenses: expensesRes.data as Expense[] | null,
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

  async upsertAppointment(app: Appointment) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('appointments') as any).upsert(app);
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

