export type LocationId = string;

export interface Location {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

export interface Client {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  notes?: string;
  created_at?: string;
}

export type AppointmentStatus = 'completato' | 'programmato' | 'annullato';

export interface Appointment {
  id: string;
  client_id?: string;
  client_name: string;
  location_id: string;
  treatment: string;
  appointment_date: string; // ISO datetime
  payment: number;
  balance: number;
  touch_up_date?: string | null; // ISO date
  lead_source?: string;
  notes?: string;
  sync_google_calendar?: boolean;
  google_calendar_event_id?: string;
  status: AppointmentStatus;
}

export interface WeddingService {
  id: string;
  bride_name: string;
  client_id?: string;
  wedding_date: string; // ISO datetime
  trial_date?: string | null; // ISO datetime
  people_count: number;
  trial_deposit: number;
  wedding_balance: number;
  total_price: number;
  notes?: string;
  sync_google_calendar?: boolean;
  status: AppointmentStatus;
}

export interface ExtraMakeup {
  id: string;
  client_id?: string;
  client_name: string;
  amount: number;
  status: string;
}

export interface Expense {
  id: string;
  date: string; // ISO date
  category: string;
  item: string;
  amount: number;
  notes?: string;
}

export interface AppSettings {
  pin_hash: string;
  monthly_target: number;
  yearly_target: number;
  supabase_url?: string;
  supabase_anon_key?: string;
  google_calendar_email?: string;
}

export interface UnifiedEvent {
  id: string;
  type: 'pmu' | 'wedding_day' | 'wedding_trial';
  title: string;
  client_name: string;
  date: string; // ISO string
  location_name?: string;
  location_color?: string;
  amount: number;
  balance?: number;
  status: AppointmentStatus;
  rawPmu?: Appointment;
  rawWedding?: WeddingService;
}

