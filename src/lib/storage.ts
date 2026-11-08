import { Location, Client, Appointment, WeddingService, ExtraMakeup, Expense, AppSettings } from '@/types';
import initialData from '@/data/initialData.json';

const STORAGE_KEYS = {
  LOCATIONS: 'fede_locations',
  CLIENTS: 'fede_clients',
  APPOINTMENTS: 'fede_appointments',
  WEDDINGS: 'fede_weddings',
  EXTRA_MAKEUPS: 'fede_extra_makeups',
  EXPENSES: 'fede_expenses',
  SETTINGS: 'fede_settings',
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
    return getStorage<Client[]>(STORAGE_KEYS.CLIENTS, initialData.clients as Client[]);
  },
  saveClients(clients: Client[]): void {
    setStorage(STORAGE_KEYS.CLIENTS, clients);
  },
  addOrUpdateClient(client: Partial<Client> & { full_name: string }): Client {
    const clients = this.getClients();
    const existingIndex = client.id 
      ? clients.findIndex(c => c.id === client.id)
      : clients.findIndex(c => c.full_name.trim().toLowerCase() === client.full_name.trim().toLowerCase());

    if (existingIndex >= 0) {
      const updated = { ...clients[existingIndex], ...client };
      clients[existingIndex] = updated;
      this.saveClients(clients);
      return updated;
    } else {
      const newClient: Client = {
        id: client.id || `client-${Date.now()}`,
        full_name: client.full_name.trim(),
        phone: client.phone || '',
        email: client.email || '',
        notes: client.notes || '',
        created_at: new Date().toISOString(),
      };
      clients.unshift(newClient);
      this.saveClients(clients);
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
    }
  },
  deleteAppointment(id: string): void {
    const appointments = this.getAppointments().filter(a => a.id !== id);
    this.saveAppointments(appointments);
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
    }
  },
  deleteWedding(id: string): void {
    const weddings = this.getWeddings().filter(w => w.id !== id);
    this.saveWeddings(weddings);
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
    return newExpense;
  },
  deleteExpense(id: string): void {
    const expenses = this.getExpenses().filter(e => e.id !== id);
    this.saveExpenses(expenses);
  },

  getSettings(): AppSettings {
    return getStorage<AppSettings>(STORAGE_KEYS.SETTINGS, initialData.settings as AppSettings);
  },
  saveSettings(settings: AppSettings): void {
    setStorage(STORAGE_KEYS.SETTINGS, settings);
  },

  // Export full JSON backup
  exportFullBackup(): string {
    const data = {
      locations: this.getLocations(),
      clients: this.getClients(),
      appointments: this.getAppointments(),
      weddings: this.getWeddings(),
      expenses: this.getExpenses(),
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

