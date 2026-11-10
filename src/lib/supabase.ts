import { createClient } from '@supabase/supabase-js';
import { Location, Client, Appointment, WeddingService, Expense, AppSettings, GiftVoucher, ServicePrice } from '@/types';

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
      const [locations, clients, appointments, weddings, expenses, vouchersRes, settingsVouchers, servicePricesRes, settingsServicePrices] = await Promise.all([
        supabase.from('locations').select('*').then((r: any) => (r.data as Location[]) || []),
        fetchAllRows<Client>(supabase, 'clients', 'created_at'),
        fetchAllRows<Appointment>(supabase, 'appointments', 'appointment_date'),
        fetchAllRows<WeddingService>(supabase, 'wedding_services', 'wedding_date'),
        fetchAllRows<Expense>(supabase, 'expenses', 'date'),
        (async () => {
          try {
            const res = await (supabase.from('gift_vouchers') as any).select('*').order('purchase_date', { ascending: false });
            if (res.error) return null;
            return (res.data as GiftVoucher[]) || [];
          } catch {
            return null;
          }
        })(),
        (async () => {
          try {
            const res = await (supabase.from('settings') as any).select('value').eq('key', 'gift_vouchers').single();
            if (res.data?.value && Array.isArray(res.data.value)) {
              return res.data.value as GiftVoucher[];
            }
            return null;
          } catch {
            return null;
          }
        })(),
        (async () => {
          try {
            const res = await (supabase.from('service_prices') as any).select('*').order('name', { ascending: true });
            if (res.error) return null;
            return (res.data as ServicePrice[]) || [];
          } catch {
            return null;
          }
        })(),
        (async () => {
          try {
            const res = await (supabase.from('settings') as any).select('value').eq('key', 'service_prices').single();
            if (res.data?.value && Array.isArray(res.data.value)) {
              return res.data.value as ServicePrice[];
            }
            return null;
          } catch {
            return null;
          }
        })(),
      ]);

      const vouchers: GiftVoucher[] = vouchersRes !== null ? vouchersRes : (settingsVouchers || []);
      const servicePrices: ServicePrice[] = servicePricesRes !== null ? servicePricesRes : (settingsServicePrices || []);

      return {
        locations,
        clients,
        appointments,
        weddings,
        expenses,
        vouchers,
        servicePrices,
      };
    } catch (err) {
      console.warn('CloudSync fetchAll failed, offline or error:', err);
      return null;
    }
  },

  async upsertLocation(loc: Location) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('locations') as any).upsert({
        id: loc.id,
        name: loc.name,
        color: loc.color,
        address: loc.address || '',
        active: loc.active ?? true,
      });
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
  },

  async syncAllLocations(locations: Location[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const records = locations.map(l => ({
        id: l.id,
        name: l.name,
        color: l.color,
        address: l.address || '',
        active: l.active ?? true,
      }));
      await (supabase.from('locations') as any).upsert(records);
    } catch (e) {
      console.error('syncAllLocations error:', e);
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


  async upsertGiftVoucher(voucher: GiftVoucher, allVouchersFallback?: GiftVoucher[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      // 1. Try dedicated table first
      const res = await (supabase.from('gift_vouchers') as any).upsert(voucher);
      if (res && res.error) {
        // Table does not exist in schema yet; use settings table fallback
        if (allVouchersFallback) {
          await (supabase.from('settings') as any).upsert({
            key: 'gift_vouchers',
            value: allVouchersFallback,
          });
        }
      }
    } catch (e) {
      console.error('upsertGiftVoucher error:', e);
      if (allVouchersFallback) {
        try {
          await (supabase.from('settings') as any).upsert({
            key: 'gift_vouchers',
            value: allVouchersFallback,
          });
        } catch {}
      }
    }
  },

  async deleteGiftVoucher(id: string, allVouchersFallback?: GiftVoucher[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const res = await (supabase.from('gift_vouchers') as any).delete().eq('id', id);
      if (res && res.error) {
        if (allVouchersFallback) {
          await (supabase.from('settings') as any).upsert({
            key: 'gift_vouchers',
            value: allVouchersFallback,
          });
        }
      }
    } catch (e) {
      console.error('deleteGiftVoucher error:', e);
      if (allVouchersFallback) {
        try {
          await (supabase.from('settings') as any).upsert({
            key: 'gift_vouchers',
            value: allVouchersFallback,
          });
        } catch {}
      }
    }
  },

  async syncAllGiftVouchers(vouchers: GiftVoucher[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      // Always keep settings row synced as safety backup
      await (supabase.from('settings') as any).upsert({
        key: 'gift_vouchers',
        value: vouchers,
      });
    } catch (e) {
      console.error('syncAllGiftVouchers error:', e);
    }
  },

  async upsertServicePrice(item: ServicePrice, allFallback?: ServicePrice[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const res = await (supabase.from('service_prices') as any).upsert(item);
      if (res && res.error) {
        if (allFallback) {
          await (supabase.from('settings') as any).upsert({
            key: 'service_prices',
            value: allFallback,
          });
        }
      }
    } catch (e) {
      console.error('upsertServicePrice error:', e);
      if (allFallback) {
        try {
          await (supabase.from('settings') as any).upsert({
            key: 'service_prices',
            value: allFallback,
          });
        } catch {}
      }
    }
  },

  async deleteServicePrice(id: string, allFallback?: ServicePrice[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const res = await (supabase.from('service_prices') as any).delete().eq('id', id);
      if (res && res.error) {
        if (allFallback) {
          await (supabase.from('settings') as any).upsert({
            key: 'service_prices',
            value: allFallback,
          });
        }
      }
    } catch (e) {
      console.error('deleteServicePrice error:', e);
      if (allFallback) {
        try {
          await (supabase.from('settings') as any).upsert({
            key: 'service_prices',
            value: allFallback,
          });
        } catch {}
      }
    }
  },

  async syncAllServicePrices(prices: ServicePrice[]) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      await (supabase.from('settings') as any).upsert({
        key: 'service_prices',
        value: prices,
      });
    } catch (e) {
      console.error('syncAllServicePrices error:', e);
    }
  }
};

