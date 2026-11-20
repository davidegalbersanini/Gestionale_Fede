import { Location, Client, Appointment, WeddingService, Expense, AppSettings, GiftVoucher, ServicePrice } from '@/types';
import { CloudSync } from '@/lib/supabase';
import { PASTEL_LOCATION_PALETTE } from '@/lib/locationColors';

const DEFAULT_SETTINGS: AppSettings = {
  pin_hash: '',
  yearly_target: 35000,
};

const STORAGE_KEYS = {
  LOCATIONS: 'fede_locations_v2',
  CLIENTS: 'fede_clients_v2',
  APPOINTMENTS: 'fede_appointments_v2',
  WEDDINGS: 'fede_weddings_v2',
  EXPENSES: 'fede_expenses_v2',
  GIFT_VOUCHERS: 'fede_gift_vouchers_v2',
  SERVICE_PRICES: 'fede_service_prices_v2',
  SETTINGS: 'fede_settings_v2',
  PIN_AUTH: 'fede_pin_auth',
};

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
    const raw = getStorage<Location[]>(STORAGE_KEYS.LOCATIONS, []);
    // Auto-migrate legacy high-saturation colors to elegant pastel palette
    const legacyMap: Record<string, string> = {
      '#ec4899': '#F472B6', // Beauty Center
      '#EC4899': '#F472B6',
      '#398e62': '#34D399', // The Touch
      '#398E62': '#34D399',
      '#f43f5e': '#34D399',
      '#F43F5E': '#34D399',
      '#5f36ab': '#A78BFA', // AliceinWondernails
      '#5F36AB': '#A78BFA',
      '#8b5cf6': '#A78BFA',
      '#8B5CF6': '#A78BFA',
    };
    let changed = false;
    const sanitized = raw.map((loc, idx) => {
      const curColor = (loc.color || '').trim();
      let newColor = curColor;
      if (legacyMap[curColor]) {
        newColor = legacyMap[curColor];
      } else if (!newColor || newColor === '#000000') {
        newColor = PASTEL_LOCATION_PALETTE[idx % PASTEL_LOCATION_PALETTE.length];
      }
      if (newColor !== loc.color) {
        changed = true;
        return { ...loc, color: newColor };
      }
      return loc;
    });
    if (changed) {
      setStorage(STORAGE_KEYS.LOCATIONS, sanitized);
    }
    return sanitized;
  },
  saveLocations(locations: Location[]): void {
    setStorage(STORAGE_KEYS.LOCATIONS, locations);
    CloudSync.syncAllLocations(locations);
  },
  addOrUpdateLocation(loc: Location): Location {
    const list = this.getLocations();
    const idx = list.findIndex(l => l.id === loc.id);
    const updatedList = idx >= 0
      ? list.map(l => (l.id === loc.id ? loc : l))
      : [...list, loc];
    setStorage(STORAGE_KEYS.LOCATIONS, updatedList);
    CloudSync.upsertLocation(loc);
    return loc;
  },
  deleteLocation(id: string): void {
    const list = this.getLocations().filter(l => l.id !== id);
    setStorage(STORAGE_KEYS.LOCATIONS, list);
    CloudSync.deleteLocation(id);

    // Clean up orphaned service_prices for this location
    const allPrices = this.getServicePrices();
    const orphaned = allPrices.filter(sp => sp.location_id === id);
    if (orphaned.length > 0) {
      const remaining = allPrices.filter(sp => sp.location_id !== id);
      setStorage(STORAGE_KEYS.SERVICE_PRICES, remaining);
      orphaned.forEach(sp => {
        CloudSync.deleteServicePrice(sp.id, remaining);
      });
    }
  },

  getClients(): Client[] {
    const rawClients = getStorage<any[]>(STORAGE_KEYS.CLIENTS, []);
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
      const oldClient = clients[existingIndex];
      const updated: Client = {
        ...oldClient,
        ...client,
        first_name: first || oldClient.first_name,
        last_name: last || oldClient.last_name,
        full_name: computedFullName || oldClient.full_name,
        phone: client.phone !== undefined ? client.phone : oldClient.phone,
        notes: client.notes !== undefined ? client.notes : oldClient.notes,
      };
      clients[existingIndex] = updated;
      this.saveClients(clients);
      CloudSync.upsertClient(updated);

      // If full_name changed, cascade to existing appointments, weddings, and vouchers
      if (oldClient.full_name && updated.full_name && oldClient.full_name !== updated.full_name) {
        const apps = this.getAppointments();
        let appsChanged = false;
        apps.forEach(a => {
          if (a.client_id === updated.id || a.client_name === oldClient.full_name) {
            a.client_name = updated.full_name;
            if (!a.client_id) a.client_id = updated.id;
            appsChanged = true;
            CloudSync.upsertAppointment(a);
          }
        });
        if (appsChanged) this.saveAppointments(apps);

        const weddings = this.getWeddings();
        let weddingsChanged = false;
        weddings.forEach(w => {
          if (w.client_id === updated.id || w.bride_name === oldClient.full_name) {
            w.bride_name = updated.full_name;
            if (!w.client_id) w.client_id = updated.id;
            weddingsChanged = true;
            CloudSync.upsertWedding(w);
          }
        });
        if (weddingsChanged) this.saveWeddings(weddings);

        const vouchers = this.getGiftVouchers();
        let anyVoucherChanged = false;
        const modifiedVouchers: GiftVoucher[] = [];
        vouchers.forEach(v => {
          let itemChanged = false;
          if (v.buyer_id === updated.id || v.buyer_name === oldClient.full_name) {
            v.buyer_name = updated.full_name;
            itemChanged = true;
          }
          if (v.recipient_id === updated.id || v.recipient_name === oldClient.full_name) {
            v.recipient_name = updated.full_name;
            itemChanged = true;
          }
          if (itemChanged) {
            anyVoucherChanged = true;
            modifiedVouchers.push(v);
          }
        });
        if (anyVoucherChanged) {
          this.saveGiftVouchers(vouchers);
          modifiedVouchers.forEach(v => {
            CloudSync.upsertGiftVoucher(v, vouchers);
          });
        }
      }

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
    return getStorage<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
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

    // Ensure client exists in Rubrica and link client_id before cloud upsert
    if (newApp.client_name) {
      const ensured = this.addOrUpdateClient({
        id: newApp.client_id,
        full_name: newApp.client_name,
      });
      if (ensured && (!newApp.client_id || newApp.client_id !== ensured.id)) {
        newApp.client_id = ensured.id;
        appointments[0] = newApp;
        this.saveAppointments(appointments);
      }
    }

    CloudSync.upsertAppointment(newApp);
    return newApp;
  },
  updateAppointment(app: Appointment): Appointment {
    const appointments = this.getAppointments();
    const idx = appointments.findIndex(a => a.id === app.id);
    if (idx >= 0) {
      const updated: Appointment = { ...app };
      if (updated.client_name) {
        const ensured = this.addOrUpdateClient({
          id: updated.client_id,
          full_name: updated.client_name,
        });
        if (ensured && !updated.client_id) {
          updated.client_id = ensured.id;
        }
      }
      appointments[idx] = updated;
      this.saveAppointments(appointments);
      CloudSync.upsertAppointment(updated);
      return updated;
    }
    return app;
  },
  patchAppointment(id: string, patch: Partial<Appointment>): Appointment | null {
    const appointments = this.getAppointments();
    const idx = appointments.findIndex(a => a.id === id);
    if (idx < 0) return null;
    const updated: Appointment = { ...appointments[idx], ...patch };
    appointments[idx] = updated;
    this.saveAppointments(appointments);
    CloudSync.upsertAppointment(updated);
    return updated;
  },
  deleteAppointment(id: string): void {
    const appointments = this.getAppointments().filter(a => a.id !== id);
    this.saveAppointments(appointments);
    CloudSync.deleteAppointment(id);
  },

  getWeddings(): WeddingService[] {
    return getStorage<WeddingService[]>(STORAGE_KEYS.WEDDINGS, []);
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

    // Ensure bride exists in Rubrica without overwriting existing client notes
    if (newWedding.bride_name) {
      const existingClient = this.getClients().find(c =>
        (newWedding.client_id && c.id === newWedding.client_id) ||
        c.full_name.trim().toLowerCase() === newWedding.bride_name.trim().toLowerCase()
      );
      const ensured = this.addOrUpdateClient({
        id: newWedding.client_id,
        full_name: newWedding.bride_name,
        ...(existingClient ? {} : { notes: `Sposa - Matrimonio: ${newWedding.wedding_date.slice(0, 10)}` }),
      });
      if (ensured && (!newWedding.client_id || newWedding.client_id !== ensured.id)) {
        newWedding.client_id = ensured.id;
        weddings[0] = newWedding;
        this.saveWeddings(weddings);
      }
    }

    CloudSync.upsertWedding(newWedding);
    return newWedding;
  },
  updateWedding(wedding: WeddingService): WeddingService {
    const weddings = this.getWeddings();
    const idx = weddings.findIndex(w => w.id === wedding.id);
    if (idx >= 0) {
      const updated: WeddingService = { ...wedding };
      if (updated.bride_name) {
        const ensured = this.addOrUpdateClient({
          id: updated.client_id,
          full_name: updated.bride_name,
        });
        if (ensured && !updated.client_id) {
          updated.client_id = ensured.id;
        }
      }
      weddings[idx] = updated;
      this.saveWeddings(weddings);
      CloudSync.upsertWedding(updated);
      return updated;
    }
    return wedding;
  },
  patchWedding(id: string, patch: Partial<WeddingService>): WeddingService | null {
    const weddings = this.getWeddings();
    const idx = weddings.findIndex(w => w.id === id);
    if (idx < 0) return null;
    const updated: WeddingService = { ...weddings[idx], ...patch };
    weddings[idx] = updated;
    this.saveWeddings(weddings);
    CloudSync.upsertWedding(updated);
    return updated;
  },
  deleteWedding(id: string): void {
    const weddings = this.getWeddings().filter(w => w.id !== id);
    this.saveWeddings(weddings);
    CloudSync.deleteWedding(id);
  },

  getExpenses(): Expense[] {
    return getStorage<Expense[]>(STORAGE_KEYS.EXPENSES, []);
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
  updateExpense(expense: Expense): void {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex(e => e.id === expense.id);
    if (idx >= 0) {
      expenses[idx] = expense;
      this.saveExpenses(expenses);
      CloudSync.upsertExpense(expense);
    }
  },
  deleteExpense(id: string): void {
    const expenses = this.getExpenses().filter(e => e.id !== id);
    this.saveExpenses(expenses);
    CloudSync.deleteExpense(id);
  },

  getGiftVouchers(): GiftVoucher[] {
    const raw = getStorage<GiftVoucher[]>(STORAGE_KEYS.GIFT_VOUCHERS, []);
    return raw.map(v => {
      const initAmount = v.initial_amount !== undefined ? v.initial_amount : (v.amount || 0);
      const remAmount = v.remaining_amount !== undefined ? v.remaining_amount : (v.is_used ? 0 : initAmount);
      return {
        ...v,
        initial_amount: initAmount,
        remaining_amount: remAmount,
        amount: initAmount,
        category: 'pmu',
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
      category: 'pmu',
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

    if (newVoucher.buyer_name) {
      this.addOrUpdateClient({
        id: newVoucher.buyer_id,
        full_name: newVoucher.buyer_name,
      });
    }

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
  },

  getSettings(): AppSettings {
    return getStorage<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },
  saveSettings(settings: AppSettings): void {
    setStorage(STORAGE_KEYS.SETTINGS, { ...settings, pin_hash: '' });
    CloudSync.upsertAppSettings(settings);
  },

  clearLocalCache(): void {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
    try {
      localStorage.removeItem('fede_auth_session');
    } catch {
      // ignore
    }
  },

  getServicePrices(): ServicePrice[] {
    return getStorage<ServicePrice[]>(STORAGE_KEYS.SERVICE_PRICES, []);
  },
  saveServicePrices(prices: ServicePrice[]): void {
    setStorage(STORAGE_KEYS.SERVICE_PRICES, prices);
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
      setStorage(STORAGE_KEYS.SERVICE_PRICES, nextList);
      CloudSync.upsertServicePrice(updated, nextList);
    } else {
      updated = {
        id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        location_id: priceItem.location_id,
        name: priceItem.name.trim(),
        price: Number(priceItem.price) || 0,
        created_at: new Date().toISOString(),
      };
      const nextList = [...list, updated];
      setStorage(STORAGE_KEYS.SERVICE_PRICES, nextList);
      CloudSync.upsertServicePrice(updated, nextList);
    }
    return updated;
  },
  deleteServicePrice(id: string): void {
    const list = this.getServicePrices().filter(item => item.id !== id);
    setStorage(STORAGE_KEYS.SERVICE_PRICES, list);
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
    settings?: AppSettings;
  } | null> {
    const cloud = await CloudSync.fetchAll();
    if (!cloud) return null;

    if (cloud.locations.ok) {
      setStorage(STORAGE_KEYS.LOCATIONS, cloud.locations.data);
    }
    if (cloud.clients.ok) {
      setStorage(STORAGE_KEYS.CLIENTS, cloud.clients.data);
    }
    if (cloud.appointments.ok) {
      setStorage(STORAGE_KEYS.APPOINTMENTS, cloud.appointments.data);
    }
    if (cloud.weddings.ok) {
      setStorage(STORAGE_KEYS.WEDDINGS, cloud.weddings.data);
    }
    if (cloud.expenses.ok) {
      setStorage(STORAGE_KEYS.EXPENSES, cloud.expenses.data);
    }
    if (cloud.vouchers.ok) {
      setStorage(STORAGE_KEYS.GIFT_VOUCHERS, cloud.vouchers.data);
    }
    if (cloud.servicePrices.ok) {
      setStorage(STORAGE_KEYS.SERVICE_PRICES, cloud.servicePrices.data);
    }
    if (cloud.appSettings) {
      const localSettings = this.getSettings();
      const merged: AppSettings = {
        ...localSettings,
        pin_hash: cloud.appSettings.pin_hash || localSettings.pin_hash,
        yearly_target:
          cloud.appSettings.yearly_target !== undefined
            ? cloud.appSettings.yearly_target
            : localSettings.yearly_target,
        monthly_target:
          cloud.appSettings.monthly_target !== undefined
            ? cloud.appSettings.monthly_target
            : localSettings.monthly_target,
        google_calendar_email:
          cloud.appSettings.google_calendar_email !== undefined
            ? cloud.appSettings.google_calendar_email
            : localSettings.google_calendar_email,
      };
      setStorage(STORAGE_KEYS.SETTINGS, merged);
    }

    return {
      locations: this.getLocations(),
      clients: this.getClients(),
      appointments: this.getAppointments(),
      weddings: this.getWeddings(),
      expenses: this.getExpenses(),
      vouchers: this.getGiftVouchers(),
      servicePrices: this.getServicePrices(),
      settings: this.getSettings(),
    };
  },

  exportFullBackup(): string {
    const data = {
      locations: this.getLocations(),
      clients: this.getClients(),
      appointments: this.getAppointments(),
      weddings: this.getWeddings(),
      expenses: this.getExpenses(),
      gift_vouchers: this.getGiftVouchers(),
      service_prices: this.getServicePrices(),
      settings: this.getSettings(),
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  },

  resetToDefault(): void {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.reload();
    }
  },
};
