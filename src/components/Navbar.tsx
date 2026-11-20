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
      className: 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white',
      icon: <Cloud className="w-3.5 h-3.5" />,
    },
    syncing: {
      label: 'Sync...',
      title: 'Sincronizzazione in corso...',
      className: 'bg-sky-950/60 border-sky-700/50 text-sky-300',
      icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    },
    synced: {
      label: 'Sync OK',
      title: 'Dati sincronizzati con Supabase. Clicca per aggiornare.',
      className: 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/80',
      icon: <Cloud className="w-3.5 h-3.5" />,
    },
    offline: {
      label: 'Offline',
      title: 'Modalità offline (dati salvati localmente). Clicca per riprovare.',
      className: 'bg-amber-950/50 border-amber-700/50 text-amber-400 hover:bg-amber-950/80',
      icon: <CloudOff className="w-3.5 h-3.5" />,
    },
    error: {
      label: 'Errore Sync',
      title: 'Errore sincronizzazione cloud. Clicca per riprovare.',
      className: 'bg-red-950/60 border-red-700/60 text-red-400 hover:bg-red-950/90',
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
  const tabs = [
    { id: 'agenda' as ActiveTab, label: 'Agenda', icon: Calendar },
    { id: 'clients' as ActiveTab, label: 'Rubrica', icon: Users },
    { id: 'locations' as ActiveTab, label: 'Sedi & Listino', icon: Store },
    { id: 'expenses' as ActiveTab, label: 'Spese', icon: Receipt },
    { id: 'dashboard' as ActiveTab, label: 'Riepilogo', icon: TrendingUp },
  ];

  return (
    <>
      {/* Desktop Top Header */}
      <header className="hidden md:block sticky top-0 z-40 bg-stone-950/85 backdrop-blur-xl border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onSelectTab('agenda')}>
            <div className="h-10 px-2 rounded-2xl bg-white/95 border border-stone-200/80 flex items-center justify-center shadow-md shadow-rose-950/20">
              <img src="/logo.png" alt="Gestionale Fede" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white block">
                Gestionale Fede
              </span>
            </div>
          </div>

          {/* Center Tabs */}
          <nav className="flex items-center bg-stone-900 border border-stone-800 p-1 rounded-2xl shadow-inner">
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
                      : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
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
              className="w-10 h-10 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-white transition-colors"
              title="Impostazioni"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Top Header (Small brand + sync + settings) */}
      <div className="md:hidden sticky top-0 z-40 bg-stone-950/90 backdrop-blur-xl border-b border-stone-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 px-1.5 rounded-xl bg-white/95 border border-stone-200/80 flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Gestionale Fede" className="h-5 w-auto object-contain" />
          </div>
          <span className="text-sm font-black text-white tracking-tight">Gestionale Fede</span>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge syncStatus={syncStatus} onResync={onResync} compact />
          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-white"
            title="Impostazioni"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar (iOS Native Style) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/90 backdrop-blur-2xl border-t border-stone-800/80 pb-safe">
        <div className="grid grid-cols-5 h-16">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTab(t.id)}
                className={`flex flex-col items-center justify-center gap-1 transition-all ${
                  isActive ? 'text-rose-500' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                <span className={`text-[10px] font-semibold tracking-tight ${isActive ? 'font-bold' : ''}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
