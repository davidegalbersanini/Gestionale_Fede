'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Appointment,
  WeddingService,
  Client,
  Location,
  Expense,
  AppSettings,
  GiftVoucher,
  ServicePrice,
  SyncStatus,
  ToastVariant,
  MasterSheetStatus,
} from '@/types';
import { DataService } from '@/lib/storage';
import { setCloudErrorHandler, setAuthExpiredHandler } from '@/lib/supabase';
import { syncCalendarAutomatically, deleteCalendarEventSilently } from '@/lib/calendar';
import {
  getMasterSheetStatus,
  triggerMasterSheetSync,
  scheduleBackgroundSheetPush,
} from '@/lib/sheetsClient';
import { PASTEL_EVENT_COLORS } from '@/lib/locationColors';
import { reconcileVoucherUsage } from '@/lib/finance';
import PinLock from '@/components/PinLock';
import Navbar, { ActiveTab } from '@/components/Navbar';
import AgendaView from '@/components/AgendaView';
import ClientsView from '@/components/ClientsView';
import LocationsView from '@/components/LocationsView';
import ExpensesView from '@/components/ExpensesView';
import DashboardView from '@/components/DashboardView';
import AppointmentModal from '@/components/AppointmentModal';
import WeddingModal from '@/components/WeddingModal';
import SettingsModal from '@/components/SettingsModal';
import GiftVouchersModal from '@/components/GiftVouchersModal';
import ConfirmModal from '@/components/ConfirmModal';
import { AlertTriangle, Trash2, Link as LinkIcon } from 'lucide-react';

export default function Home() {
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weddings, setWeddings] = useState<WeddingService[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([]);
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    pin_hash: '1234',
    yearly_target: 35000,
  });

  // Pre-fill state for Modals
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedClientForPmu, setSelectedClientForPmu] = useState<Client | null>(null);
  const [selectedClientForWedding, setSelectedClientForWedding] = useState<Client | null>(null);
  const [selectedClientForVoucher, setSelectedClientForVoucher] = useState<Client | null>(null);

  // Modals state
  const [isPmuModalOpen, setIsPmuModalOpen] = useState(false);
  const [editingPmu, setEditingPmu] = useState<Appointment | null>(null);

  const [isWeddingModalOpen, setIsWeddingModalOpen] = useState(false);
  const [editingWedding, setEditingWedding] = useState<WeddingService | null>(null);

  const [isGiftVouchersOpen, setIsGiftVouchersOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Master Google Sheet Sync state
  const [sheetStatus, setSheetStatus] = useState<MasterSheetStatus | null>(null);
  const [isSheetSyncing, setIsSheetSyncing] = useState(false);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', duration: number = 4000) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToast({ message, variant });
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, duration);
    },
    []
  );

  // Linked / simple delete confirmation targets
  const [linkedDeleteTarget, setLinkedDeleteTarget] = useState<{
    target: Appointment;
    linked: Appointment;
  } | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Appointment | null>(null);

  const refreshSupabaseState = useCallback(async () => {
    const synced = await DataService.syncFromCloud();
    if (!synced) return false;
    if (synced.locations) setLocations(synced.locations);
    if (synced.clients) setClients(synced.clients);
    if (synced.appointments) setAppointments(synced.appointments);
    if (synced.weddings) setWeddings(synced.weddings);
    if (synced.expenses) setExpenses(synced.expenses);
    if (synced.vouchers) setVouchers(synced.vouchers);
    if (synced.servicePrices) setServicePrices(synced.servicePrices);
    if (synced.settings) setSettings(synced.settings);
    return true;
  }, []);

  const refreshMasterSheetStatus = useCallback(async () => {
    const status = await getMasterSheetStatus();
    setSheetStatus(status);
    return status;
  }, []);

  const queueSheetPush = useCallback(() => {
    scheduleBackgroundSheetPush(async res => {
      if (res.status === 'synced') {
        await refreshMasterSheetStatus();
        if (res.dataChanged) {
          await refreshSupabaseState();
        }
        if (res.warning) {
          showToast(res.warning, 'info', 6000);
        }
      }
    });
  }, [refreshMasterSheetStatus, refreshSupabaseState, showToast]);

  const handleSyncSheet = useCallback(
    async (opts?: { createIfMissing?: boolean; silent?: boolean }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!opts?.silent) showToast('Connessione offline: sincronizzazione rimandata.', 'info', 3500);
        return null;
      }

      setIsSheetSyncing(true);
      try {
        const res = await triggerMasterSheetSync({
          source: opts?.createIfMissing ? 'manual' : 'manual',
          force: true,
          createIfMissing: Boolean(opts?.createIfMissing),
        });
        await refreshMasterSheetStatus();

        if (!res.ok) {
          if (!opts?.silent) {
            if (res.sheetsApiDisabled) {
              showToast(
                'Abilita "Google Sheets API" su Google Cloud Console prima di sincronizzare il Foglio.',
                'error',
                6500
              );
            } else {
              showToast(res.error || 'Errore nella sincronizzazione con il Foglio Google.', 'error', 5500);
            }
          }
          return res;
        }

        if (res.dataChanged) {
          await refreshSupabaseState();
        }
        if (res.warning) {
          showToast(res.warning, 'info', 6500);
        } else if (!opts?.silent) {
          showToast(res.summary || 'Foglio Google sincronizzato!', 'success', 4000);
        }
        return res;
      } finally {
        setIsSheetSyncing(false);
      }
    },
    [refreshMasterSheetStatus, refreshSupabaseState, showToast]
  );

  const handleCreateMasterSheet = useCallback(async () => {
    const res = await handleSyncSheet({ createIfMissing: true, silent: false });
    if (res?.ok && res.spreadsheetUrl && typeof window !== 'undefined') {
      window.open(res.spreadsheetUrl, '_blank', 'noopener,noreferrer');
    }
  }, [handleSyncSheet]);

  const performCloudSync = useCallback(
    async (manualTrigger: boolean = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
        return;
      }

      setSyncStatus('syncing');
      try {
        const ok = await refreshSupabaseState();
        if (!ok) {
          setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
          return;
        }
        setSyncStatus('synced');

        const st = await refreshMasterSheetStatus();
        if (st.googleConnected && st.spreadsheetId) {
          setIsSheetSyncing(true);
          try {
            const sheetRes = await triggerMasterSheetSync({
              source: manualTrigger ? 'manual' : 'app',
              force: manualTrigger,
              createIfMissing: false,
            });
            await refreshMasterSheetStatus();
            if (sheetRes.ok && sheetRes.dataChanged) {
              await refreshSupabaseState();
              if (sheetRes.summary) {
                showToast(sheetRes.summary, 'success', 4000);
              }
            }
            if (sheetRes.warning) {
              showToast(sheetRes.warning, 'info', 6000);
            }
          } finally {
            setIsSheetSyncing(false);
          }
        }
      } catch (err) {
        console.warn('Sync with Supabase was deferred:', err);
        setSyncStatus('error');
      }
    },
    [refreshMasterSheetStatus, refreshSupabaseState, showToast]
  );

  // Check URL params for Google connection callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gcal = params.get('gcal');
      if (gcal === 'connected') {
        showToast(
          'Account Google collegato con successo! Sincronizzazione calendario e salvataggio Drive attivi.',
          'success',
          5000
        );
        window.history.replaceState({}, '', window.location.pathname);
      } else if (gcal === 'error' || gcal === 'failed') {
        showToast("Connessione con l'Account Google non completata o annullata.", 'error', 5000);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [showToast]);

  // Check server session cookie on mount
  useEffect(() => {
    let active = true;
    fetch('/api/auth/pin', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        setIsAuthenticated(Boolean(data?.authenticated));
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setIsAuthenticated(false);
        setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load data & sync with cloud ONLY after authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    setLocations(DataService.getLocations());
    setClients(DataService.getClients());
    setAppointments(DataService.getAppointments());
    setWeddings(DataService.getWeddings());
    setExpenses(DataService.getExpenses());
    setVouchers(DataService.getGiftVouchers());
    setServicePrices(DataService.getServicePrices());
    setSettings(DataService.getSettings());

    setCloudErrorHandler(msg => {
      setSyncStatus('error');
      showToast(msg, 'error', 5500);
    });

    setAuthExpiredHandler(() => {
      setIsAuthenticated(false);
      showToast('Sessione scaduta. Inserisci il PIN per continuare.', 'info', 4000);
    });

    performCloudSync();

    const handleOnline = () => {
      performCloudSync();
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      setCloudErrorHandler(null);
      setAuthExpiredHandler(null);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [isAuthenticated, performCloudSync, showToast]);

  // Save / Update PMU Appointment
  const handleSavePmu = (appData: Omit<Appointment, 'id'>, createTouchUpFollowup?: boolean) => {
    const prevPmu = editingPmu;
    let savedApp: Appointment;

    if (prevPmu && prevPmu.id) {
      savedApp = DataService.updateAppointment({ ...prevPmu, ...appData });
    } else {
      savedApp = DataService.addAppointment(appData);
    }

    // Reconcile gift voucher deduction/restoration cleanly
    const prevUsage =
      prevPmu?.used_gift_voucher && prevPmu.used_gift_voucher_id
        ? { voucherId: prevPmu.used_gift_voucher_id, amount: prevPmu.used_gift_voucher_amount || 0 }
        : null;
    const nextUsage =
      savedApp.used_gift_voucher && savedApp.used_gift_voucher_id
        ? { voucherId: savedApp.used_gift_voucher_id, amount: savedApp.used_gift_voucher_amount || 0 }
        : null;

    if (prevUsage || nextUsage) {
      const { changedVouchers } = reconcileVoucherUsage(
        DataService.getGiftVouchers(),
        prevUsage,
        nextUsage,
        { id: savedApp.client_id, name: savedApp.client_name }
      );
      if (changedVouchers.length > 0) {
        changedVouchers.forEach(v => DataService.updateGiftVoucher(v));
        setVouchers(DataService.getGiftVouchers());
      }
    }

    const loc = locations.find(l => l.id === savedApp.location_id);
    const locationString = loc?.address ? `${loc.name} (${loc.address})` : loc?.name || '';
    const datePrefix = savedApp.appointment_date.slice(0, 10);
    const startTimePart = savedApp.appointment_date.includes('T')
      ? savedApp.appointment_date.split('T')[1].slice(0, 5)
      : '10:00';
    const fullEndDateTime = savedApp.end_time ? `${datePrefix}T${savedApp.end_time}:00` : undefined;

    // Google Calendar Sync for primary appointment
    if (savedApp.sync_google_calendar) {
      syncCalendarAutomatically({
        eventId: savedApp.google_calendar_event_id,
        title: `PMU: ${savedApp.client_name} - ${savedApp.treatment}`,
        startDate: savedApp.appointment_date,
        endDate: fullEndDateTime,
        location: locationString,
        colorHex: loc?.color,
        details: `Tipo: Trattamento PMU\nTrattamento: ${savedApp.treatment}\nOrario: ${startTimePart}${
          savedApp.end_time ? ` - ${savedApp.end_time}` : ''
        }\nTotale Trattamento: ${savedApp.total_price ?? savedApp.payment + savedApp.balance}€\nDenaro Ricevuto: ${
          savedApp.payment
        }€\nDa Saldare: ${savedApp.balance}€\nNote: ${savedApp.notes || ''}`,
      }).then(res => {
        if (res.eventId && res.eventId !== savedApp.google_calendar_event_id) {
          DataService.patchAppointment(savedApp.id, { google_calendar_event_id: res.eventId });
          setAppointments(DataService.getAppointments());
        }
      });
    } else if (prevPmu?.google_calendar_event_id) {
      deleteCalendarEventSilently(prevPmu.google_calendar_event_id);
      DataService.patchAppointment(savedApp.id, { google_calendar_event_id: undefined });
    }

    // Automatic Touch-up follow-up booking if requested and not already linked
    if (createTouchUpFollowup && savedApp.touch_up_date && !savedApp.linked_appointment_id) {
      const touchUpTime = savedApp.touch_up_time || '10:00';
      const touchUpEndTime = savedApp.touch_up_end_time || '11:30';
      const touchUpStartIso = `${savedApp.touch_up_date}T${touchUpTime}:00`;
      const touchUpEndIso = `${savedApp.touch_up_date}T${touchUpEndTime}:00`;

      const createdTouchUp = DataService.addAppointment({
        client_id: savedApp.client_id,
        client_name: savedApp.client_name,
        location_id: savedApp.location_id,
        category: savedApp.category,
        treatment: `Ritocco (${savedApp.treatment})`,
        appointment_date: touchUpStartIso,
        end_time: touchUpEndTime,
        payment: 0,
        balance: 0,
        touch_up_date: null,
        notes: `Promemoria ritocco programmato da prima seduta del ${datePrefix}`,
        sync_google_calendar: savedApp.sync_google_calendar,
        status: 'programmato',
        linked_appointment_id: savedApp.id,
        is_touch_up: true,
      });

      DataService.patchAppointment(savedApp.id, { linked_appointment_id: createdTouchUp.id });

      if (savedApp.sync_google_calendar) {
        syncCalendarAutomatically({
          title: `PMU Ritocco: ${savedApp.client_name} - Ritocco (${savedApp.treatment})`,
          startDate: touchUpStartIso,
          endDate: touchUpEndIso,
          location: locationString,
          colorHex: loc?.color,
          details: `Ritocco programmato per ${savedApp.client_name}\nCollegato alla prima seduta del ${datePrefix}`,
        }).then(res => {
          if (res.eventId) {
            DataService.patchAppointment(createdTouchUp.id, { google_calendar_event_id: res.eventId });
            setAppointments(DataService.getAppointments());
          }
        });
      }
    }

    setAppointments(DataService.getAppointments());
    setClients(DataService.getClients());
    setEditingPmu(null);
    setSelectedClientForPmu(null);
    queueSheetPush();
  };

  const handleDeletePmu = (id: string) => {
    const currentApps = DataService.getAppointments();
    const target = currentApps.find(a => a.id === id);
    if (!target) return;

    if (target.linked_appointment_id) {
      const linked = currentApps.find(a => a.id === target.linked_appointment_id);
      if (linked) {
        setLinkedDeleteTarget({ target, linked });
        return;
      }
    }

    setDeleteConfirmTarget(target);
  };

  const executeDeletePmu = (targetId: string, deleteLinked: boolean) => {
    const currentApps = DataService.getAppointments();
    const target = currentApps.find(a => a.id === targetId);

    if (target) {
      const appsToDelete: Appointment[] = [target];
      const linked = target.linked_appointment_id
        ? currentApps.find(a => a.id === target.linked_appointment_id)
        : undefined;

      if (deleteLinked && linked) {
        appsToDelete.push(linked);
      } else if (!deleteLinked && linked) {
        DataService.patchAppointment(linked.id, { linked_appointment_id: undefined });
      }

      // Restore any voucher balance deducted by deleted appointments
      let vouchersUpdated = false;
      appsToDelete.forEach(app => {
        if (app.used_gift_voucher && app.used_gift_voucher_id && (app.used_gift_voucher_amount || 0) > 0) {
          const { changedVouchers } = reconcileVoucherUsage(
            DataService.getGiftVouchers(),
            { voucherId: app.used_gift_voucher_id, amount: app.used_gift_voucher_amount },
            null
          );
          if (changedVouchers.length > 0) {
            changedVouchers.forEach(v => DataService.updateGiftVoucher(v));
            vouchersUpdated = true;
          }
        }
        if (app.google_calendar_event_id) {
          deleteCalendarEventSilently(app.google_calendar_event_id);
        }
        DataService.deleteAppointment(app.id);
      });

      if (vouchersUpdated) {
        setVouchers(DataService.getGiftVouchers());
      }
    }

    setAppointments(DataService.getAppointments());
    setLinkedDeleteTarget(null);
    setDeleteConfirmTarget(null);
    showToast(
      deleteLinked ? 'Entrambi gli appuntamenti sono stati eliminati.' : 'Appuntamento eliminato.',
      'success',
      3500
    );
    queueSheetPush();
  };

  // Save / Update Wedding / Event
  const handleSaveWedding = (weddingData: Omit<WeddingService, 'id'>) => {
    const prevWedding = editingWedding;
    let savedWedding: WeddingService;

    if (prevWedding && prevWedding.id) {
      savedWedding = DataService.updateWedding({ ...prevWedding, ...weddingData });
    } else {
      savedWedding = DataService.addWedding(weddingData);
    }

    // Reconcile gift voucher deduction/restoration cleanly
    const prevUsage =
      prevWedding?.used_gift_voucher && prevWedding.used_gift_voucher_id
        ? { voucherId: prevWedding.used_gift_voucher_id, amount: prevWedding.used_gift_voucher_amount || 0 }
        : null;
    const nextUsage =
      savedWedding.used_gift_voucher && savedWedding.used_gift_voucher_id
        ? { voucherId: savedWedding.used_gift_voucher_id, amount: savedWedding.used_gift_voucher_amount || 0 }
        : null;

    if (prevUsage || nextUsage) {
      const { changedVouchers } = reconcileVoucherUsage(
        DataService.getGiftVouchers(),
        prevUsage,
        nextUsage,
        { id: savedWedding.client_id, name: savedWedding.bride_name }
      );
      if (changedVouchers.length > 0) {
        changedVouchers.forEach(v => DataService.updateGiftVoucher(v));
        setVouchers(DataService.getGiftVouchers());
      }
    }

    const eventType = savedWedding.event_type || 'Matrimonio';
    const weddingDateOnly = savedWedding.wedding_date.slice(0, 10);
    const weddingTimePart = savedWedding.wedding_date.includes('T')
      ? savedWedding.wedding_date.split('T')[1].slice(0, 5)
      : '08:30';
    const weddingEndTime = savedWedding.end_time || '11:30';
    const fullWeddingEndDateTime = `${weddingDateOnly}T${weddingEndTime}:00`;

    // Google Calendar Sync
    if (savedWedding.sync_google_calendar) {
      syncCalendarAutomatically({
        eventId: savedWedding.google_calendar_event_id,
        title: `✨ ${eventType.toUpperCase()}: ${savedWedding.bride_name}`,
        startDate: savedWedding.wedding_date,
        endDate: fullWeddingEndDateTime,
        location: savedWedding.address || '',
        colorHex: PASTEL_EVENT_COLORS.EVENT_DAY,
        details: `Tipo: ${eventType}\nCliente: ${savedWedding.bride_name}\nPersone da truccare: ${
          savedWedding.people_count
        }\nIndirizzo/Luogo: ${savedWedding.address || 'Non specificato'}\nOrario: ${weddingTimePart} - ${weddingEndTime}\nTotale Servizio: ${
          savedWedding.total_price
        }€\nAcconto/Ricevuto: ${savedWedding.trial_deposit}€\nDa saldare: ${savedWedding.wedding_balance}€\nNote: ${
          savedWedding.notes || ''
        }`,
      }).then(res => {
        if (res.eventId && res.eventId !== savedWedding.google_calendar_event_id) {
          DataService.patchWedding(savedWedding.id, { google_calendar_event_id: res.eventId });
          setWeddings(DataService.getWeddings());
        }
      });

      if (savedWedding.trial_date) {
        const trialDateOnly = savedWedding.trial_date.slice(0, 10);
        const trialTimePart = savedWedding.trial_date.includes('T')
          ? savedWedding.trial_date.split('T')[1].slice(0, 5)
          : '15:00';
        const trialEndTime = savedWedding.trial_end_time || '16:30';
        const fullTrialEndDateTime = `${trialDateOnly}T${trialEndTime}:00`;

        syncCalendarAutomatically({
          eventId: savedWedding.google_calendar_trial_event_id,
          title: `💄 Prova Trucco: ${savedWedding.bride_name} (${eventType})`,
          startDate: savedWedding.trial_date,
          endDate: fullTrialEndDateTime,
          location: savedWedding.address || '',
          colorHex: PASTEL_EVENT_COLORS.EVENT_TRIAL,
          details: `Prova trucco per evento del ${weddingDateOnly}\nOrario: ${trialTimePart} - ${trialEndTime}\nAcconto prova: ${savedWedding.trial_deposit}€\nNote: ${savedWedding.notes || ''}`,
        }).then(res => {
          if (res.eventId && res.eventId !== savedWedding.google_calendar_trial_event_id) {
            DataService.patchWedding(savedWedding.id, { google_calendar_trial_event_id: res.eventId });
            setWeddings(DataService.getWeddings());
          }
        });
      } else if (prevWedding?.google_calendar_trial_event_id) {
        deleteCalendarEventSilently(prevWedding.google_calendar_trial_event_id);
        DataService.patchWedding(savedWedding.id, { google_calendar_trial_event_id: undefined });
      }
    } else if (prevWedding?.google_calendar_event_id || prevWedding?.google_calendar_trial_event_id) {
      if (prevWedding.google_calendar_event_id) {
        deleteCalendarEventSilently(prevWedding.google_calendar_event_id);
      }
      if (prevWedding.google_calendar_trial_event_id) {
        deleteCalendarEventSilently(prevWedding.google_calendar_trial_event_id);
      }
      DataService.patchWedding(savedWedding.id, {
        google_calendar_event_id: undefined,
        google_calendar_trial_event_id: undefined,
      });
    }

    setWeddings(DataService.getWeddings());
    setClients(DataService.getClients());
    setEditingWedding(null);
    setSelectedClientForWedding(null);
    queueSheetPush();
  };

  const handleDeleteWedding = (id: string) => {
    const target = DataService.getWeddings().find(w => w.id === id);
    if (target) {
      if (target.used_gift_voucher && target.used_gift_voucher_id && (target.used_gift_voucher_amount || 0) > 0) {
        const { changedVouchers } = reconcileVoucherUsage(
          DataService.getGiftVouchers(),
          { voucherId: target.used_gift_voucher_id, amount: target.used_gift_voucher_amount },
          null
        );
        if (changedVouchers.length > 0) {
          changedVouchers.forEach(v => DataService.updateGiftVoucher(v));
          setVouchers(DataService.getGiftVouchers());
        }
      }
      if (target.google_calendar_event_id) {
        deleteCalendarEventSilently(target.google_calendar_event_id);
      }
      if (target.google_calendar_trial_event_id) {
        deleteCalendarEventSilently(target.google_calendar_trial_event_id);
      }
      DataService.deleteWedding(id);
    }
    setWeddings(DataService.getWeddings());
    showToast('Evento eliminato.', 'success', 3500);
    queueSheetPush();
  };

  // Save Client from Rubrica
  const handleSaveClient = (
    clientData: Partial<Client> & { full_name: string; first_name?: string; last_name?: string }
  ) => {
    DataService.addOrUpdateClient(clientData);
    setClients(DataService.getClients());
    setAppointments(DataService.getAppointments());
    setWeddings(DataService.getWeddings());
    setVouchers(DataService.getGiftVouchers());
    queueSheetPush();
  };

  const handleDeleteClient = (id: string) => {
    DataService.deleteClient(id);
    setClients(DataService.getClients());
    showToast('Contatto rimosso dalla rubrica.', 'success', 3000);
    queueSheetPush();
  };

  // Expenses Handlers
  const handleAddExpense = (expenseData: Omit<Expense, 'id'>) => {
    DataService.addExpense(expenseData);
    setExpenses(DataService.getExpenses());
    queueSheetPush();
  };

  const handleUpdateExpense = (expense: Expense) => {
    DataService.updateExpense(expense);
    setExpenses(DataService.getExpenses());
    showToast('Spesa aggiornata.', 'success', 3000);
    queueSheetPush();
  };

  const handleDeleteExpense = (id: string) => {
    DataService.deleteExpense(id);
    setExpenses(DataService.getExpenses());
    queueSheetPush();
  };

  // Gift Vouchers Handlers
  const handleSaveGiftVoucher = (voucherData: Omit<GiftVoucher, 'id'>) => {
    const created = DataService.addGiftVoucher(voucherData);
    setVouchers(DataService.getGiftVouchers());
    setClients(DataService.getClients());
    showToast(`Buono Regalo di ${created.amount}€ emesso con successo! Ricavi aggiornati.`, 'success', 4000);
    queueSheetPush();
  };

  const handleDeleteGiftVoucher = (id: string) => {
    DataService.deleteGiftVoucher(id);
    setVouchers(DataService.getGiftVouchers());
    showToast('Buono Regalo eliminato.', 'success', 3000);
    queueSheetPush();
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    DataService.saveSettings(newSettings);
    queueSheetPush();
  };

  if (!authChecked) {
    return (
      <div className="min-h-[100dvh] bg-stone-50 flex items-center justify-center text-stone-500 text-xs">
        Verifica sessione...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinLock onSuccess={() => setIsAuthenticated(true)} />;
  }

  const toastClasses =
    toast?.variant === 'error'
      ? 'bg-red-600 border-red-400 text-white'
      : toast?.variant === 'info'
      ? 'bg-amber-600 border-amber-400 text-white'
      : 'bg-emerald-600 border-emerald-400 text-white';

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-clip bg-stone-50 text-stone-900 flex flex-col pb-nav-safe md:pb-8">
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        syncStatus={syncStatus}
        onResync={() => performCloudSync(true)}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-1.5rem)] px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between text-xs sm:text-sm font-medium animate-fade-in border ${toastClasses}`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-3 font-bold hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 flex-1 w-full min-w-0 overflow-x-clip">
        {activeTab === 'agenda' && (
          <AgendaView
            appointments={appointments}
            weddings={weddings}
            locations={locations}
            activeVouchersCount={vouchers.filter(v => !v.is_used).length}
            onOpenGiftVouchers={() => {
              setSelectedClientForVoucher(null);
              setIsGiftVouchersOpen(true);
            }}
            onOpenNewPmu={dayIso => {
              if (dayIso) setSelectedCalendarDate(dayIso);
              setEditingPmu(null);
              setSelectedClientForPmu(null);
              setIsPmuModalOpen(true);
            }}
            onOpenNewWedding={dayIso => {
              if (dayIso) setSelectedCalendarDate(dayIso);
              setEditingWedding(null);
              setSelectedClientForWedding(null);
              setIsWeddingModalOpen(true);
            }}
            onSelectPmu={app => {
              setEditingPmu(app);
              setIsPmuModalOpen(true);
            }}
            onSelectWedding={w => {
              setEditingWedding(w);
              setIsWeddingModalOpen(true);
            }}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsView
            clients={clients}
            appointments={appointments}
            weddings={weddings}
            vouchers={vouchers}
            onSaveClient={handleSaveClient}
            onDeleteClient={handleDeleteClient}
            onOpenNewAppointmentForClient={client => {
              setSelectedClientForPmu(client);
              setEditingPmu(null);
              setSelectedCalendarDate(new Date().toISOString().slice(0, 10));
              setIsPmuModalOpen(true);
            }}
            onOpenNewWeddingForClient={client => {
              setSelectedClientForWedding(client);
              setEditingWedding(null);
              setSelectedCalendarDate(new Date().toISOString().slice(0, 10));
              setIsWeddingModalOpen(true);
            }}
            onOpenNewVoucherForClient={client => {
              setSelectedClientForVoucher(client);
              setIsGiftVouchersOpen(true);
            }}
          />
        )}

        {activeTab === 'locations' && (
          <LocationsView
            locations={locations}
            servicePrices={servicePrices}
            onUpdateLocations={newLocs => {
              setLocations(newLocs);
              DataService.saveLocations(newLocs);
              queueSheetPush();
            }}
            onSaveLocation={loc => {
              DataService.addOrUpdateLocation(loc);
              setLocations(DataService.getLocations());
              queueSheetPush();
            }}
            onDeleteLocationProp={id => {
              DataService.deleteLocation(id);
              setLocations(DataService.getLocations());
              setServicePrices(DataService.getServicePrices());
              queueSheetPush();
            }}
            onSaveServicePrice={item => {
              DataService.addOrUpdateServicePrice(item);
              setServicePrices(DataService.getServicePrices());
              queueSheetPush();
            }}
            onDeleteServicePrice={id => {
              DataService.deleteServicePrice(id);
              setServicePrices(DataService.getServicePrices());
              queueSheetPush();
            }}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            appointments={appointments}
            weddings={weddings}
            expenses={expenses}
            locations={locations}
            vouchers={vouchers}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onShowToast={(msg, variant) => showToast(msg, variant || 'success', 5000)}
            sheetStatus={sheetStatus}
            isSheetSyncing={isSheetSyncing}
            onSyncSheet={() => handleSyncSheet({ silent: false })}
            onCreateMasterSheet={handleCreateMasterSheet}
          />
        )}
      </main>

      {/* Modals */}
      <AppointmentModal
        isOpen={isPmuModalOpen}
        onClose={() => {
          setIsPmuModalOpen(false);
          setEditingPmu(null);
          setSelectedClientForPmu(null);
        }}
        onSave={handleSavePmu}
        onDelete={handleDeletePmu}
        initialAppointment={editingPmu}
        clients={clients}
        locations={locations}
        servicePrices={servicePrices}
        vouchers={vouchers}
        defaultDate={selectedCalendarDate}
        defaultClient={selectedClientForPmu}
      />

      <WeddingModal
        isOpen={isWeddingModalOpen}
        onClose={() => {
          setIsWeddingModalOpen(false);
          setEditingWedding(null);
          setSelectedClientForWedding(null);
        }}
        onSave={handleSaveWedding}
        onDelete={handleDeleteWedding}
        initialWedding={editingWedding}
        clients={clients}
        vouchers={vouchers}
        defaultDate={selectedCalendarDate}
        defaultClient={selectedClientForWedding}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onLockApp={() => setIsAuthenticated(false)}
        sheetStatus={sheetStatus}
        isSheetSyncing={isSheetSyncing}
        onSyncSheet={() => handleSyncSheet({ silent: false })}
        onCreateMasterSheet={handleCreateMasterSheet}
      />

      <GiftVouchersModal
        isOpen={isGiftVouchersOpen}
        onClose={() => {
          setIsGiftVouchersOpen(false);
          setSelectedClientForVoucher(null);
        }}
        vouchers={vouchers}
        clients={clients}
        onSaveVoucher={handleSaveGiftVoucher}
        onDeleteVoucher={handleDeleteGiftVoucher}
        defaultBuyerClient={selectedClientForVoucher}
      />

      {/* Linked Delete Confirmation Dialog */}
      {linkedDeleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-fade-in"
          onClick={e => {
            if (e.target === e.currentTarget) setLinkedDeleteTarget(null);
          }}
        >
          <div className="bg-white border border-stone-200 rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto overflow-x-hidden p-5 sm:p-6 shadow-2xl text-stone-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-500/30 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Appuntamento Collegato</h3>
                <p className="text-xs text-stone-500">Rilevato un ritocco/prima seduta associato</p>
              </div>
            </div>

            <p className="text-xs text-stone-700 mb-4 leading-relaxed">
              Stai per eliminare l&apos;appuntamento di{' '}
              <strong className="text-stone-900">{linkedDeleteTarget.target.client_name}</strong> (
              {linkedDeleteTarget.target.treatment}) del {linkedDeleteTarget.target.appointment_date.slice(0, 10)}.
            </p>

            <div className="bg-stone-100 p-3.5 rounded-2xl border border-stone-200 mb-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1 mb-1">
                <LinkIcon className="w-3 h-3" /> Appuntamento Collegato:
              </span>
              <p className="text-xs font-semibold text-stone-900">{linkedDeleteTarget.linked.treatment}</p>
              <p className="text-[11px] text-stone-500">
                Data: {linkedDeleteTarget.linked.appointment_date.slice(0, 10)}{' '}
                {linkedDeleteTarget.linked.appointment_date.includes('T')
                  ? `alle ${linkedDeleteTarget.linked.appointment_date.split('T')[1].slice(0, 5)}`
                  : ''}
              </p>
            </div>

            <p className="text-xs font-medium text-stone-700 mb-4">
              Vuoi eliminare anche l&apos;appuntamento collegato?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => executeDeletePmu(linkedDeleteTarget.target.id, true)}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200/60"
              >
                <Trash2 className="w-4 h-4" /> Elimina ENTRAMBI gli appuntamenti
              </button>

              <button
                type="button"
                onClick={() => executeDeletePmu(linkedDeleteTarget.target.id, false)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-medium text-xs transition-colors"
              >
                Elimina SOLO questo appuntamento
              </button>

              <button
                type="button"
                onClick={() => setLinkedDeleteTarget(null)}
                className="w-full py-2 text-stone-500 hover:text-stone-900 text-xs font-medium transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmTarget)}
        title="Conferma Eliminazione"
        message={
          deleteConfirmTarget
            ? `Sei sicura di voler eliminare l'appuntamento di ${deleteConfirmTarget.client_name} (${deleteConfirmTarget.treatment}) del ${deleteConfirmTarget.appointment_date.slice(0, 10)}?`
            : ''
        }
        confirmLabel="Elimina"
        onConfirm={() => {
          if (deleteConfirmTarget) {
            executeDeletePmu(deleteConfirmTarget.id, false);
          }
        }}
        onCancel={() => setDeleteConfirmTarget(null)}
      />
    </div>
  );
}
