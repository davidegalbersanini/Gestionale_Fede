'use client';

import React, { useState, useEffect } from 'react';
import { Appointment, WeddingService, Client, Location, Expense, AppSettings } from '@/types';
import { DataService } from '@/lib/storage';
import PinLock from '@/components/PinLock';
import Navbar, { ActiveTab } from '@/components/Navbar';
import AgendaView from '@/components/AgendaView';
import ClientsView from '@/components/ClientsView';
import ExpensesView from '@/components/ExpensesView';
import DashboardView from '@/components/DashboardView';
import AppointmentModal from '@/components/AppointmentModal';
import WeddingModal from '@/components/WeddingModal';
import SettingsModal from '@/components/SettingsModal';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('agenda');

  // State
  const [locations, setLocations] = useState<Location[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weddings, setWeddings] = useState<WeddingService[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    pin_hash: '1234',
    monthly_target: 2700,
    yearly_target: 35000,
  });

  // Modals state
  const [isPmuModalOpen, setIsPmuModalOpen] = useState(false);
  const [editingPmu, setEditingPmu] = useState<Appointment | null>(null);

  const [isWeddingModalOpen, setIsWeddingModalOpen] = useState(false);
  const [editingWedding, setEditingWedding] = useState<WeddingService | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load data on mount
  useEffect(() => {
    setLocations(DataService.getLocations());
    setClients(DataService.getClients());
    setAppointments(DataService.getAppointments());
    setWeddings(DataService.getWeddings());
    setExpenses(DataService.getExpenses());
    setSettings(DataService.getSettings());
  }, []);

  // Save / Update PMU Appointment
  const handleSavePmu = (appData: Omit<Appointment, 'id'>, createTouchUpFollowup?: boolean) => {
    if (editingPmu) {
      const updated: Appointment = { ...editingPmu, ...appData };
      DataService.updateAppointment(updated);
    } else {
      const created = DataService.addAppointment(appData);

      // Automatic Touch-up follow up booking if requested
      if (createTouchUpFollowup && appData.touch_up_date) {
        DataService.addAppointment({
          client_id: created.client_id,
          client_name: created.client_name,
          location_id: created.location_id,
          treatment: `Ritocco (${created.treatment})`,
          appointment_date: `${appData.touch_up_date}T10:00:00`,
          payment: 0,
          balance: 0,
          touch_up_date: null,
          lead_source: created.lead_source,
          notes: `Promemoria ritocco programmato da prima seduta del ${created.appointment_date.slice(0, 10)}`,
          sync_google_calendar: created.sync_google_calendar,
          status: 'programmato',
        });
      }
    }

    setAppointments(DataService.getAppointments());
    setClients(DataService.getClients());
    setEditingPmu(null);
  };

  const handleDeletePmu = (id: string) => {
    DataService.deleteAppointment(id);
    setAppointments(DataService.getAppointments());
  };

  // Save / Update Wedding
  const handleSaveWedding = (weddingData: Omit<WeddingService, 'id'>) => {
    if (editingWedding) {
      const updated: WeddingService = { ...editingWedding, ...weddingData };
      DataService.updateWedding(updated);
    } else {
      DataService.addWedding(weddingData);
    }
    setWeddings(DataService.getWeddings());
    setClients(DataService.getClients());
    setEditingWedding(null);
  };

  const handleDeleteWedding = (id: string) => {
    DataService.deleteWedding(id);
    setWeddings(DataService.getWeddings());
  };

  // Save Client from Rubrica
  const handleSaveClient = (clientData: Partial<Client> & { full_name: string }) => {
    DataService.addOrUpdateClient(clientData);
    setClients(DataService.getClients());
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 flex-1 w-full">
        {activeTab === 'agenda' && (
          <AgendaView
            appointments={appointments}
            weddings={weddings}
            locations={locations}
            onOpenNewPmu={() => {
              setEditingPmu(null);
              setIsPmuModalOpen(true);
            }}
            onOpenNewWedding={() => {
              setEditingWedding(null);
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
            onSaveClient={handleSaveClient}
            onOpenNewAppointmentForClient={client => {
              setEditingPmu({
                id: '',
                client_id: client.id,
                client_name: client.full_name,
                location_id: locations[0]?.id || '',
                treatment: 'Ritocco',
                appointment_date: new Date().toISOString(),
                payment: 0,
                balance: 0,
                status: 'programmato',
              });
              setIsPmuModalOpen(true);
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
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
      </main>

      {/* Modals */}
      <AppointmentModal
        isOpen={isPmuModalOpen}
        onClose={() => {
          setIsPmuModalOpen(false);
          setEditingPmu(null);
        }}
        onSave={handleSavePmu}
        onDelete={handleDeletePmu}
        initialAppointment={editingPmu}
        clients={clients}
        locations={locations}
      />

      <WeddingModal
        isOpen={isWeddingModalOpen}
        onClose={() => {
          setIsWeddingModalOpen(false);
          setEditingWedding(null);
        }}
        onSave={handleSaveWedding}
        onDelete={handleDeleteWedding}
        initialWedding={editingWedding}
        clients={clients}
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
    </div>
  );
}
