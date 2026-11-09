'use client';

import React, { useState, useEffect } from 'react';
import { Appointment, WeddingService, Client, Location, Expense, AppSettings, GiftVoucher } from '@/types';
import { DataService } from '@/lib/storage';
import { syncCalendarAutomatically, deleteCalendarEventSilently } from '@/lib/calendar';
import PinLock from '@/components/PinLock';
import Navbar, { ActiveTab } from '@/components/Navbar';
import AgendaView from '@/components/AgendaView';
import ClientsView from '@/components/ClientsView';
import ExpensesView from '@/components/ExpensesView';
import DashboardView from '@/components/DashboardView';
import AppointmentModal from '@/components/AppointmentModal';
import WeddingModal from '@/components/WeddingModal';
import SettingsModal from '@/components/SettingsModal';
import GiftVouchersModal from '@/components/GiftVouchersModal';
import { AlertTriangle, Trash2, Link as LinkIcon, X } from 'lucide-react';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weddings, setWeddings] = useState<WeddingService[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([]);
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Linked delete confirmation modal
  const [linkedDeleteTarget, setLinkedDeleteTarget] = useState<{
    target: Appointment;
    linked: Appointment;
  } | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Appointment | null>(null);

  // Check URL params for Google connection callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gcal = params.get('gcal');
      if (gcal === 'connected') {
        setToastMessage('Account Google collegato con successo! Sincronizzazione calendario e salvataggio Drive attivi.');
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setToastMessage(null), 5000);
      } else if (gcal === 'error' || gcal === 'failed') {
        setToastMessage('Connessione con l\'Account Google non completata o annullata.');
        window.history.replaceState({}, '', window.location.pathname);
        setTimeout(() => setToastMessage(null), 5000);
      }
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    // 1. Immediate local cache load
    setLocations(DataService.getLocations());
    setClients(DataService.getClients());
    setAppointments(DataService.getAppointments());
    setWeddings(DataService.getWeddings());
    setExpenses(DataService.getExpenses());
    setVouchers(DataService.getGiftVouchers());
    setSettings(DataService.getSettings());

    // 2. Background sync with Supabase Cloud
    DataService.syncFromCloud().then(synced => {
      if (synced) {
        if (synced.locations) setLocations(synced.locations);
        if (synced.clients) setClients(synced.clients);
        if (synced.appointments) setAppointments(synced.appointments);
        if (synced.weddings) setWeddings(synced.weddings);
        if (synced.expenses) setExpenses(synced.expenses);
        if (synced.vouchers) setVouchers(synced.vouchers);
      }
    }).catch(err => {
      console.warn('Sync with Supabase was deferred:', err);
    });
  }, []);

  // Save / Update PMU Appointment
  const handleSavePmu = (appData: Omit<Appointment, 'id'>, createTouchUpFollowup?: boolean) => {
    // If a gift voucher was used, update voucher's remaining amount and link beneficiary if needed
    if (appData.used_gift_voucher && appData.used_gift_voucher_id && (appData.used_gift_voucher_amount ?? 0) > 0) {
      const allVouchers = DataService.getGiftVouchers();
      const targetVoucher = allVouchers.find(v => v.id === appData.used_gift_voucher_id);
      if (targetVoucher) {
        const deduct = appData.used_gift_voucher_amount || 0;
        const currentRem = targetVoucher.remaining_amount ?? targetVoucher.amount;
        const newRem = Math.max(0, currentRem - deduct);
        targetVoucher.remaining_amount = newRem;
        if (newRem <= 0) {
          targetVoucher.is_used = true;
          targetVoucher.used_date = new Date().toISOString().slice(0, 10);
        }
        // Auto-assign recipient if none was assigned
        if (!targetVoucher.recipient_name && appData.client_name) {
          targetVoucher.recipient_name = appData.client_name;
          targetVoucher.recipient_id = appData.client_id;
        }
        DataService.updateGiftVoucher(targetVoucher);
        setVouchers(DataService.getGiftVouchers());
      }
    }

    if (editingPmu && editingPmu.id) {
      const updated: Appointment = { ...editingPmu, ...appData };
      DataService.updateAppointment(updated);
    } else {
      const createdPrimary = DataService.addAppointment(appData);

      // Automatic Touch-up follow up booking if requested
      if (createTouchUpFollowup && appData.touch_up_date) {
        const touchUpTime = appData.touch_up_time || '10:00';
        const touchUpEndTime = appData.touch_up_end_time || '11:30';
        const touchUpStartIso = `${appData.touch_up_date}T${touchUpTime}:00`;
        const touchUpEndIso = `${appData.touch_up_date}T${touchUpEndTime}:00`;

        const createdTouchUp = DataService.addAppointment({
          client_id: createdPrimary.client_id,
          client_name: createdPrimary.client_name,
          location_id: createdPrimary.location_id,
          category: createdPrimary.category,
          treatment: `Ritocco (${createdPrimary.treatment})`,
          appointment_date: touchUpStartIso,
          end_time: touchUpEndTime,
          payment: 0,
          balance: 0,
          touch_up_date: null,
          notes: `Promemoria ritocco programmato da prima seduta del ${createdPrimary.appointment_date.slice(0, 10)}`,
          sync_google_calendar: createdPrimary.sync_google_calendar,
          status: 'programmato',
          linked_appointment_id: createdPrimary.id,
          is_touch_up: true,
        });

        // Link primary to the touch-up appointment
        createdPrimary.linked_appointment_id = createdTouchUp.id;
        DataService.updateAppointment(createdPrimary);

        // Sync touch-up to Google Calendar if enabled
        if (createdPrimary.sync_google_calendar) {
          const loc = locations.find(l => l.id === createdPrimary.location_id);
          const locationString = loc?.address ? `${loc.name} (${loc.address})` : loc?.name || '';

          syncCalendarAutomatically({
            title: `PMU Ritocco: ${createdPrimary.client_name} - Ritocco (${createdPrimary.treatment})`,
            startDate: touchUpStartIso,
            endDate: touchUpEndIso,
            location: locationString,
            details: `Ritocco programmato per ${createdPrimary.client_name}\nCollegato alla prima seduta del ${createdPrimary.appointment_date.slice(0, 10)}`,
          }).then(res => {
            if (res.eventId) {
              createdTouchUp.google_calendar_event_id = res.eventId;
              DataService.updateAppointment(createdTouchUp);
            }
          });
        }
      }
    }

    setAppointments(DataService.getAppointments());
    setClients(DataService.getClients());
    setEditingPmu(null);
    setSelectedClientForPmu(null);
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
      if (target.google_calendar_event_id) {
        deleteCalendarEventSilently(target.google_calendar_event_id);
      }
      DataService.deleteAppointment(target.id);

      if (deleteLinked && target.linked_appointment_id) {
        const linked = currentApps.find(a => a.id === target.linked_appointment_id);
        if (linked) {
          if (linked.google_calendar_event_id) {
            deleteCalendarEventSilently(linked.google_calendar_event_id);
          }
          DataService.deleteAppointment(linked.id);
        }
      } else if (!deleteLinked && target.linked_appointment_id) {
        // Unlink the other appointment
        const linked = currentApps.find(a => a.id === target.linked_appointment_id);
        if (linked) {
          linked.linked_appointment_id = undefined;
          DataService.updateAppointment(linked);
        }
      }
    }

    setAppointments(DataService.getAppointments());
    setLinkedDeleteTarget(null);
    setDeleteConfirmTarget(null);
    setToastMessage(deleteLinked ? 'Entrambi gli appuntamenti sono stati eliminati.' : 'Appuntamento eliminato.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Save / Update Wedding / Event
  const handleSaveWedding = (weddingData: Omit<WeddingService, 'id'>) => {
    // If a gift voucher was used, update voucher's remaining amount and link beneficiary if needed
    if (weddingData.used_gift_voucher && weddingData.used_gift_voucher_id && (weddingData.used_gift_voucher_amount ?? 0) > 0) {
      const allVouchers = DataService.getGiftVouchers();
      const targetVoucher = allVouchers.find(v => v.id === weddingData.used_gift_voucher_id);
      if (targetVoucher) {
        const deduct = weddingData.used_gift_voucher_amount || 0;
        const currentRem = targetVoucher.remaining_amount ?? targetVoucher.amount;
        const newRem = Math.max(0, currentRem - deduct);
        targetVoucher.remaining_amount = newRem;
        if (newRem <= 0) {
          targetVoucher.is_used = true;
          targetVoucher.used_date = new Date().toISOString().slice(0, 10);
        }
        // Auto-assign recipient if none was assigned
        if (!targetVoucher.recipient_name && weddingData.bride_name) {
          targetVoucher.recipient_name = weddingData.bride_name;
          targetVoucher.recipient_id = weddingData.client_id;
        }
        DataService.updateGiftVoucher(targetVoucher);
        setVouchers(DataService.getGiftVouchers());
      }
    }

    if (editingWedding && editingWedding.id) {
      const updated: WeddingService = { ...editingWedding, ...weddingData };
      DataService.updateWedding(updated);
    } else {
      DataService.addWedding(weddingData);
    }
    setWeddings(DataService.getWeddings());
    setClients(DataService.getClients());
    setEditingWedding(null);
    setSelectedClientForWedding(null);
  };

  const handleDeleteWedding = (id: string) => {
    DataService.deleteWedding(id);
    setWeddings(DataService.getWeddings());
  };

  // Save Client from Rubrica
  const handleSaveClient = (clientData: Partial<Client> & { full_name: string; first_name?: string; last_name?: string }) => {
    DataService.addOrUpdateClient(clientData);
    setClients(DataService.getClients());
  };

  const handleDeleteClient = (id: string) => {
    DataService.deleteClient(id);
    setClients(DataService.getClients());
    setToastMessage('Contatto rimosso dalla rubrica.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Add Expense
  const handleAddExpense = (expenseData: Omit<Expense, 'id'>) => {
    DataService.addExpense(expenseData);
    setExpenses(DataService.getExpenses());
  };

  const handleDeleteExpense = (id: string) => {
    DataService.deleteExpense(id);
    setExpenses(DataService.getExpenses());
  };

  // Gift Vouchers Handlers
  const handleSaveGiftVoucher = (voucherData: Omit<GiftVoucher, 'id'>) => {
    const created = DataService.addGiftVoucher(voucherData);
    setVouchers(DataService.getGiftVouchers());
    setClients(DataService.getClients()); // Buyer might have been added to clients
    setToastMessage(`Buono Regalo di ${created.amount}€ emesso con successo! Ricavi aggiornati.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleGiftVoucherUsed = (voucher: GiftVoucher) => {
    const updated: GiftVoucher = {
      ...voucher,
      is_used: !voucher.is_used,
      used_date: !voucher.is_used ? new Date().toISOString().slice(0, 10) : null,
    };
    DataService.updateGiftVoucher(updated);
    setVouchers(DataService.getGiftVouchers());
    setToastMessage(updated.is_used ? 'Buono contrassegnato come UTILIZZATO.' : 'Buono reimpostato come DA USARE.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteGiftVoucher = (id: string) => {
    DataService.deleteGiftVoucher(id);
    setVouchers(DataService.getGiftVouchers());
    setToastMessage('Buono Regalo eliminato.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    DataService.saveSettings(newSettings);
  };

  if (!isAuthenticated) {
    return (
      <PinLock
        correctPin={settings.pin_hash || '1234'}
        onSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col pb-20 md:pb-8">
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between text-xs sm:text-sm font-medium animate-fade-in border border-emerald-400">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-3 font-bold hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 flex-1 w-full">
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
            onOpenNewPmu={(dayIso) => {
              if (dayIso) setSelectedCalendarDate(dayIso);
              setEditingPmu(null);
              setSelectedClientForPmu(null);
              setIsPmuModalOpen(true);
            }}
            onOpenNewWedding={(dayIso) => {
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

        {activeTab === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            onAddExpense={handleAddExpense}
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
            onShowToast={msg => {
              setToastMessage(msg);
              setTimeout(() => setToastMessage(null), 5000);
            }}
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
        locations={locations}
        onUpdateLocations={setLocations}
        onLockApp={() => setIsAuthenticated(false)}
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
        onToggleUsed={handleToggleGiftVoucherUsed}
        onDeleteVoucher={handleDeleteGiftVoucher}
        defaultBuyerClient={selectedClientForVoucher}
      />

      {/* Linked Delete Confirmation Dialog */}
      {linkedDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-stone-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Appuntamento Collegato</h3>
                <p className="text-xs text-stone-400">Rilevato un ritocco/prima seduta associato</p>
              </div>
            </div>

            <p className="text-xs text-stone-300 mb-4 leading-relaxed">
              Stai per eliminare l&apos;appuntamento di <strong className="text-white">{linkedDeleteTarget.target.client_name}</strong> ({linkedDeleteTarget.target.treatment}) del {linkedDeleteTarget.target.appointment_date.slice(0, 10)}.
            </p>

            <div className="bg-stone-800/80 p-3.5 rounded-2xl border border-stone-700/60 mb-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 mb-1">
                <LinkIcon className="w-3 h-3" /> Appuntamento Collegato:
              </span>
              <p className="text-xs font-semibold text-white">{linkedDeleteTarget.linked.treatment}</p>
              <p className="text-[11px] text-stone-400">
                Data: {linkedDeleteTarget.linked.appointment_date.slice(0, 10)} {linkedDeleteTarget.linked.appointment_date.includes('T') ? `alle ${linkedDeleteTarget.linked.appointment_date.split('T')[1].slice(0, 5)}` : ''}
              </p>
            </div>

            <p className="text-xs font-medium text-stone-300 mb-4">
              Vuoi eliminare anche l&apos;appuntamento collegato?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => executeDeletePmu(linkedDeleteTarget.target.id, true)}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-950/40"
              >
                <Trash2 className="w-4 h-4" /> Elimina ENTRAMBI gli appuntamenti
              </button>

              <button
                type="button"
                onClick={() => executeDeletePmu(linkedDeleteTarget.target.id, false)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-medium text-xs transition-colors"
              >
                Elimina SOLO questo appuntamento
              </button>

              <button
                type="button"
                onClick={() => setLinkedDeleteTarget(null)}
                className="w-full py-2 text-stone-400 hover:text-white text-xs font-medium transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Delete Confirmation Dialog */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-stone-100">
            <h3 className="text-base font-bold text-white mb-2">Conferma Eliminazione</h3>
            <p className="text-xs text-stone-300 mb-5 leading-relaxed">
              Sei sicura di voler eliminare l&apos;appuntamento di <strong className="text-white">{deleteConfirmTarget.client_name}</strong> ({deleteConfirmTarget.treatment}) del {deleteConfirmTarget.appointment_date.slice(0, 10)}?
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => executeDeletePmu(deleteConfirmTarget.id, false)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
