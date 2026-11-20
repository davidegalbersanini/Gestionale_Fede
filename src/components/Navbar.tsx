'use client';

import React from 'react';
import { SyncStatus } from '@/types';
import { Calendar, Users, Store, Receipt, TrendingUp, Settings, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';

export type ActiveTab = 'agenda' | 'clients' | 'locations' | 'expenses' | 'dashboard';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenSettings: () => void;
  syncStatus?: SyncStatus;
  onResync?: () => void;
}

function SyncBadge({
  syncStatus = 'idle',
  onResync,
  compact = false,
}: {
  syncStatus?: SyncStatus;
  onResync?: () => void;
  compact?: boolean;
}) {
  const config: Record<
    SyncStatus,
    { label: string; title: string; className: string; icon: React.ReactNode }
  > = {
    idle: {
      label: 'Cloud',
      title: 'Sincronizza con il cloud',
      className: 'bg-white border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50',
      icon: <Cloud className="w-3.5 h-3.5" />,
    },
    syncing: {
      label: 'Sync...',
      title: 'Sincronizzazione in corso...',
      className: 'bg-sky-50 border-sky-200 text-sky-700',
      icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    },
    synced: {
      label: 'Sync OK',
      title: 'Dati sincronizzati con Supabase. Clicca per aggiornare.',
      className: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70',
      icon: <Cloud className="w-3.5 h-3.5" />,
    },
    offline: {
      label: 'Offline',
      title: 'Modalità offline (dati salvati localmente). Clicca per riprovare.',
      className: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/70',
      icon: <CloudOff className="w-3.5 h-3.5" />,
    },
    error: {
      label: 'Errore Sync',
      title: 'Errore sincronizzazione cloud. Clicca per riprovare.',
      className: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100/70',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
  };

  const cur = config[syncStatus];

  return (
    <button
      type="button"
      onClick={onResync}
      disabled={syncStatus === 'syncing' || !onResync}
      title={cur.title}
      className={`border transition-colors flex items-center justify-center gap-1.5 ${
        compact ? 'w-8 h-8 rounded-xl' : 'h-10 px-3 rounded-2xl text-xs font-semibold'
      } ${cur.className}`}
    >
      {cur.icon}
      {!compact && <span className="hidden lg:inline">{cur.label}</span>}
    </button>
  );
}

export default function Navbar({
  activeTab,
  onSelectTab,
  onOpenSettings,
  syncStatus = 'idle',
  onResync,
}: NavbarProps) {
  const tabs: { id: ActiveTab; label: string; mobileLabel?: string; icon: typeof Calendar }[] = [
    { id: 'agenda' as ActiveTab, label: 'Agenda', icon: Calendar },
    { id: 'clients' as ActiveTab, label: 'Rubrica', icon: Users },
    { id: 'locations' as ActiveTab, label: 'Sedi & Listino', mobileLabel: 'Sedi', icon: Store },
    { id: 'expenses' as ActiveTab, label: 'Spese', icon: Receipt },
    { id: 'dashboard' as ActiveTab, label: 'Riepilogo', icon: TrendingUp },
  ];

  return (
    <>
      {/* Desktop Top Header */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-stone-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onSelectTab('agenda')}>
            <div className="h-10 px-2 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center shadow-xs">
              <img src="/logo.png" alt="Gestionale Fede" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-stone-900 block">
                Gestionale Fede
              </span>
            </div>
          </div>

          {/* Center Tabs */}
          <nav className="flex items-center bg-stone-100 border border-stone-200/80 p-1 rounded-2xl">
            {tabs.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/80'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <SyncBadge syncStatus={syncStatus} onResync={onResync} />
            <button
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-2xl bg-white hover:bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors"
              title="Impostazioni"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Top Header */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-stone-200/80 pt-safe w-full max-w-full overflow-x-clip">
        <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 min-w-0">
          <div
            className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none"
            onClick={() => onSelectTab('agenda')}
          >
            <div className="h-8 px-1.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center shadow-xs shrink-0">
              <img src="/logo.png" alt="Gestionale Fede" className="h-5 w-auto object-contain" />
            </div>
            <span className="text-sm font-black text-stone-900 tracking-tight truncate">
              Gestionale Fede
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SyncBadge syncStatus={syncStatus} onResync={onResync} compact />
            <button
              onClick={onOpenSettings}
              className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 shrink-0"
              title="Impostazioni"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-stone-200 w-full max-w-full overflow-x-clip pb-safe shadow-lg">
        <div className="grid grid-cols-5 h-16">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTab(t.id)}
                className={`min-w-0 px-0.5 flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive ? 'text-rose-600' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                <span
                  className={`text-[10px] leading-tight pb-0.5 truncate max-w-full font-semibold tracking-tight ${
                    isActive ? 'font-bold' : ''
                  }`}
                >
                  {t.mobileLabel || t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
