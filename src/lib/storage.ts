import { Location, Client, Appointment, WeddingService, ExtraMakeup, Expense, AppSettings, GiftVoucher, ServicePrice } from '@/types';
import initialData from '@/data/initialData.json';
import { CloudSync } from '@/lib/supabase';

const STORAGE_KEYS = {
  LOCATIONS: 'fede_locations_v2',
  CLIENTS: 'fede_clients_v2',
  APPOINTMENTS: 'fede_appointments_v2',
  WEDDINGS: 'fede_weddings_v2',
  EXTRA_MAKEUPS: 'fede_extra_makeups_v2',
  EXPENSES: 'fede_expenses_v2',
  GIFT_VOUCHERS: 'fede_gift_vouchers_v2',
  SERVICE_PRICES: 'fede_service_prices_v2',
  SETTINGS: 'fede_settings_v2',
  PIN_AUTH: 'fede_pin_auth',
};

// Check if localStorage is available
function getStorage<T>(key: string, defaultData: T): T {
  if (typeof window === 'undefined') return defaultData;
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(item) as T;
  } catch (e) {
    console.error('Storage error reading', key, e);
    return defaultData;
  }
}

function setStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Storage error writing', key, e);
  }
}

export const DataService = {
  getLocations(): Location[] {
    return getStorage<Location[]>(STORAGE_KEYS.LOCATIONS, initialData.locations);
  },
  saveLocations(locations: Location[]): void {
    setStorage(STORAGE_KEYS.LOCATIONS, locations);
  },

  getClients(): Client[] {
    const rawClients = getStorage<any[]>(STORAGE_KEYS.CLIENTS, initialData.clients as any[]);
    // Ensure first_name and last_name exist on all clients
    return rawClients.map(c => {
      if (!c.first_name || !c.last_name) {
        const parts = (c.full_name || '').trim().split(' ');
        const first = parts[0] || 'Cliente';
        const last = parts.slice(1).join(' ') || '-';
        return {
          ...c,
          first_name: c.first_name || first,
          last_name: c.last_name || last,
          full_name: `${c.first_name || first} ${c.last_name || last}`.trim(),
        };
      }
      return c as Client;
    });
  },
  saveClients(clients: Client[]): void {
    setStorage(STORAGE_KEYS.CLIENTS, clients);
  },
  deleteClient(id: string): void {
    const clients = this.getClients().filter(c => c.id !== id);
    this.saveClients(clients);
    CloudSync.deleteClient(id);
  },
  addOrUpdateClient(client: Partial<Client> & { first_name?: string; last_name?: string; full_name?: string }): Client {
    const clients = this.getClients();
    
    // Compute first_name, last_name, full_name
    let first = (client.first_name || '').trim();
    let last = (client.last_name || '').trim();
    if (!first && client.full_name) {
      const parts = client.full_name.trim().split(' ');
      first = parts[0] || 'Cliente';
      last = parts.slice(1).join(' ') || '-';
    }
    const computedFullName = `${first} ${last}`.trim();

    const existingIndex = client.id 
      ? clients.findIndex(c => c.id === client.id)
      : clients.findIndex(c => c.full_name.trim().toLowerCase() === computedFullName.toLowerCase());

    if (existingIndex >= 0) {
      const updated: Client = {
        ...clients[existingIndex],
        ...client,
        first_name: first || clients[existingIndex].first_name,
        last_name: last || clients[existingIndex].last_name,
        full_name: computedFullName || clients[existingIndex].full_name,
      };
      clients[existingIndex] = updated;
      this.saveClients(clients);
      CloudSync.upsertClient(updated);
      return updated;
    } else {
      const newClient: Client = {
        id: client.id || `client-${Date.now()}`,
        first_name: first || 'Nuovo',
        last_name: last || 'Cliente',
        full_name: computedFullName || 'Nuovo Cliente',
        phone: client.phone || '',
        notes: client.notes || '',
        created_at: new Date().toISOString(),
      };
      clients.unshift(newClient);
      this.saveClients(clients);
      CloudSync.upsertClient(newClient);
      return newClient;
    }
  },

  getAppointments(): Appointment[] {
    return getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialData.appointments as Appointment[]);
  },
  saveAppointments(appointments: Appointment[]): void {
    setStorage(STORAGE_KEYS.APPOINTMENTS, appointments);
  },
  addAppointment(app: Omit<Appointment, 'id'>): Appointment {
    const appointments = this.getAppointments();
    const newApp: Appointment = {
      ...app,
      id: `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    appointments.unshift(newApp);
    this.saveAppointments(appointments);
    CloudSync.upsertAppointment(newApp);

    // Ensure client exists in Rubrica
    if (newApp.client_name) {
      this.addOrUpdateClient({
        id: newApp.client_id,
        full_name: newApp.client_name,
      });
    }

    return newApp;
  },
  updateAppointment(app: Appointment): void {
    const appointments = this.getAppointments();
    const idx = appointments.findIndex(a => a.id === app.id);
    if (idx >= 0) {
      appointments[idx] = app;
      this.saveAppointments(appointments);
      CloudSync.upsertAppointment(app);
    }
  },
  deleteAppointment(id: string): void {
    const appointments = this.getAppointments().filter(a => a.id !== id);
    this.saveAppointments(appointments);
    CloudSync.deleteAppointment(id);
  },

  getWeddings(): WeddingService[] {
    return getStorage<WeddingService[]>(STORAGE_KEYS.WEDDINGS, initialData.weddings as WeddingService[]);
  },
  saveWeddings(weddings: WeddingService[]): void {
    setStorage(STORAGE_KEYS.WEDDINGS, weddings);
  },
  addWedding(wedding: Omit<WeddingService, 'id'>): WeddingService {
    const weddings = this.getWeddings();
    const newWedding: WeddingService = {
      ...wedding,
      id: `wedding-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    weddings.unshift(newWedding);
    this.saveWeddings(weddings);
    CloudSync.upsertWedding(newWedding);

    // Ensure bride exists in Rubrica
    if (newWedding.bride_name) {
      this.addOrUpdateClient({
        full_name: newWedding.bride_name,
        notes: `Sposa - Matrimonio: ${newWedding.wedding_date.slice(0, 10)}`,
      });
    }

    return newWedding;
  },
  updateWedding(wedding: WeddingService): void {
    const weddings = this.getWeddings();
    const idx = weddings.findIndex(w => w.id === wedding.id);
    if (idx >= 0) {
      weddings[idx] = wedding;
      this.saveWeddings(weddings);
      CloudSync.upsertWedding(wedding);
    }
  },
  deleteWedding(id: string): void {
    const weddings = this.getWeddings().filter(w => w.id !== id);
    this.saveWeddings(weddings);
    CloudSync.deleteWedding(id);
  },

  getExpenses(): Expense[] {
    return getStorage<Expense[]>(STORAGE_KEYS.EXPENSES, initialData.expenses as Expense[]);
  },
  saveExpenses(expenses: Expense[]): void {
    setStorage(STORAGE_KEYS.EXPENSES, expenses);
  },
  addExpense(expense: Omit<Expense, 'id'>): Expense {
    const expenses = this.getExpenses();
    const newExpense: Expense = {
      ...expense,
      id: `expense-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    expenses.unshift(newExpense);
    this.saveExpenses(expenses);
    CloudSync.upsertExpense(newExpense);
    return newExpense;
  },
  deleteExpense(id: string): void {
    const expenses = this.getExpenses().filter(e => e.id !== id);
    this.saveExpenses(expenses);
    CloudSync.deleteExpense(id);
  },

  getGiftVouchers(): GiftVoucher[] {
    const raw = getStorage<GiftVoucher[]>(STORAGE_KEYS.GIFT_VOUCHERS, (initialData as any).gift_vouchers || []);
    return raw.map(v => {
      const initAmount = v.initial_amount !== undefined ? v.initial_amount : (v.amount || 0);
      const remAmount = v.remaining_amount !== undefined ? v.remaining_amount : (v.is_used ? 0 : initAmount);
      return {
        ...v,
        initial_amount: initAmount,
        remaining_amount: remAmount,
        amount: initAmount,
        category: 'pmu', // PMU sotto il cofano come richiesto
        is_used: remAmount <= 0,
      };
    });
  },
  saveGiftVouchers(vouchers: GiftVoucher[]): void {
    setStorage(STORAGE_KEYS.GIFT_VOUCHERS, vouchers);
  },
  addGiftVoucher(voucher: Omit<GiftVoucher, 'id'>): GiftVoucher {
    const vouchers = this.getGiftVouchers();
    const initAmount = voucher.initial_amount !== undefined ? voucher.initial_amount : (voucher.amount || 0);
    const remAmount = voucher.remaining_amount !== undefined ? voucher.remaining_amount : initAmount;
    const newVoucher: GiftVoucher = {
      ...voucher,
      category: 'pmu', // Sempre assegnato a PMU sotto il cofano
      initial_amount: initAmount,
      remaining_amount: remAmount,
      amount: initAmount,
      is_used: remAmount <= 0,
      id: `voucher-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: new Date().toISOString(),
    };
    vouchers.unshift(newVoucher);
    this.saveGiftVouchers(vouchers);
    CloudSync.upsertGiftVoucher(newVoucher, vouchers);
    CloudSync.syncAllGiftVouchers(vouchers);

    // Make sure buyer exists in Rubrica
    if (newVoucher.buyer_name) {
      this.addOrUpdateClient({
        id: newVoucher.buyer_id,
        full_name: newVoucher.buyer_name,
      });
    }

    // If recipient is specified, also ensure recipient exists in Rubrica
    if (newVoucher.recipient_name) {
      this.addOrUpdateClient({
        id: newVoucher.recipient_id,
        full_name: newVoucher.recipient_name,
      });
    }

    return newVoucher;
  },
  updateGiftVoucher(voucher: GiftVoucher): void {
    const vouchers = this.getGiftVouchers();
    const idx = vouchers.findIndex(v => v.id === voucher.id);
    if (idx >= 0) {
      const initAmount = voucher.initial_amount !== undefined ? voucher.initial_amount : (voucher.amount || 0);
      const remAmount = voucher.remaining_amount !== undefined ? voucher.remaining_amount : (voucher.is_used ? 0 : initAmount);
      const updated: GiftVoucher = {
        ...voucher,
        initial_amount: initAmount,
        remaining_amount: remAmount,
        amount: initAmount,
        category: 'pmu',
        is_used: remAmount <= 0,
      };
      vouchers[idx] = updated;
      this.saveGiftVouchers(vouchers);
      CloudSync.upsertGiftVoucher(updated, vouchers);
      CloudSync.syncAllGiftVouchers(vouchers);

      if (updated.recipient_name) {
        this.addOrUpdateClient({
          id: updated.recipient_id,
          full_name: updated.recipient_name,
        });
      }
    }
  },
  deleteGiftVoucher(id: string): void {
    const vouchers = this.getGiftVouchers().filter(v => v.id !== id);
    this.saveGiftVouchers(vouchers);
    CloudSync.deleteGiftVoucher(id, vouchers);
    CloudSync.syncAllGiftVouchers(vouchers);
  },

  getSettings(): AppSettings {
    return getStorage<AppSettings>(STORAGE_KEYS.SETTINGS, initialData.settings as AppSettings);
  },
  saveSettings(settings: AppSettings): void {
    setStorage(STORAGE_KEYS.SETTINGS, settings);
  },

  getServicePrices(): ServicePrice[] {
    return getStorage<ServicePrice[]>(STORAGE_KEYS.SERVICE_PRICES, []);
  },
  saveServicePrices(prices: ServicePrice[]): void {
    setStorage(STORAGE_KEYS.SERVICE_PRICES, prices);
    CloudSync.syncAllServicePrices(prices);
  },
  addOrUpdateServicePrice(priceItem: Partial<ServicePrice> & { location_id: string; name: string; price: number }): ServicePrice {
    const list = this.getServicePrices();
    let updated: ServicePrice;
    if (priceItem.id) {
      updated = {
        id: priceItem.id,
        location_id: priceItem.location_id,
        name: priceItem.name.trim(),
        price: Number(priceItem.price) || 0,
        created_at: priceItem.created_at || new Date().toISOString(),
      };
      const nextList = list.map(item => (item.id === updated.id ? updated : item));
      this.saveServicePrices(nextList);
      CloudSync.upsertServicePrice(updated, nextList);
    } else {
      updated = {
        id: `sp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        location_id: priceItem.location_id,
        name: priceItem.name.trim(),
        price: Number(priceItem.price) || 0,
        created_at: new Date().toISOString(),
      };
      const nextList = [...list, updated];
      this.saveServicePrices(nextList);
      CloudSync.upsertServicePrice(updated, nextList);
    }
    return updated;
  },
  deleteServicePrice(id: string): void {
    const list = this.getServicePrices().filter(item => item.id !== id);
    this.saveServicePrices(list);
    CloudSync.deleteServicePrice(id, list);
  },

  async syncFromCloud(): Promise<{
    locations?: Location[];
    clients?: Client[];
    appointments?: Appointment[];
    weddings?: WeddingService[];
    expenses?: Expense[];
    vouchers?: GiftVoucher[];
    servicePrices?: ServicePrice[];
  } | null> {
    const cloud = await CloudSync.fetchAll();
    if (!cloud) return null;

    if (cloud.locations && cloud.locations.length > 0) {
      this.saveLocations(cloud.locations);
    }
    if (cloud.clients && cloud.clients.length > 0) {
      this.saveClients(cloud.clients);
    }
    if (cloud.appointments && cloud.appointments.length > 0) {
      this.saveAppointments(cloud.appointments);
    }
    if (cloud.weddings && cloud.weddings.length > 0) {
      this.saveWeddings(cloud.weddings);
    }
    if (cloud.expenses && cloud.expenses.length > 0) {
      this.saveExpenses(cloud.expenses);
    }
    if (cloud.vouchers && cloud.vouchers.length > 0) {
      this.saveGiftVouchers(cloud.vouchers);
    }
    if (cloud.servicePrices && cloud.servicePrices.length > 0) {
      this.saveServicePrices(cloud.servicePrices);
    }

    return {
      locations: this.getLocations(),
      clients: this.getClients(),
      appointments: this.getAppointments(),
      weddings: this.getWeddings(),
      expenses: this.getExpenses(),
      vouchers: this.getGiftVouchers(),
      servicePrices: this.getServicePrices(),
    };
  },

  // Export full JSON backup
  exportFullBackup(): string {
    const data = {
      locations: this.getLocations(),
      clients: this.getClients(),
      appointments: this.getAppointments(),
      weddings: this.getWeddings(),
      expenses: this.getExpenses(),
      gift_vouchers: this.getGiftVouchers(),
      settings: this.getSettings(),
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  },

  // Reset to initial Excel data
  resetToDefault(): void {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.reload();
    }
  }
};

