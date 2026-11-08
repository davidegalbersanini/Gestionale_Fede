'use client';

import React from 'react';
import { Calendar, Users, Receipt, TrendingUp, Settings, Sparkles } from 'lucide-react';

export type ActiveTab = 'agenda' | 'clients' | 'expenses' | 'dashboard';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenSettings: () => void;
}

export default function Navbar({ activeTab, onSelectTab, onOpenSettings }: NavbarProps) {
  const tabs = [
    { id: 'agenda' as ActiveTab, label: 'Agenda', icon: Calendar },
    { id: 'clients' as ActiveTab, label: 'Rubrica', icon: Users },
    { id: 'expenses' as ActiveTab, label: 'Spese', icon: Receipt },
    { id: 'dashboard' as ActiveTab, label: 'Riepilogo', icon: TrendingUp },
  ];

  return (
    <>
      {/* Desktop Top Header */}
      <header className="hidden md:block sticky top-0 z-40 bg-stone-950/80 backdrop-blur-xl border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('agenda')}>
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-900/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white block">
                Gestionale Fede
              </span>
              <span className="text-[10px] text-stone-400 font-medium block">
                PMU • Make-up • Spose
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

          {/* Right Action */}
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-white transition-colors"
            title="Impostazioni"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Top Header (Small brand + settings) */}
      <div className="md:hidden sticky top-0 z-40 bg-stone-950/90 backdrop-blur-xl border-b border-stone-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-sm font-black text-white tracking-tight">Gestionale Fede</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400 hover:text-white"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Bottom Tab Bar (iOS Native Style) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/90 backdrop-blur-2xl border-t border-stone-800/80 pb-safe">
        <div className="grid grid-cols-4 h-16">
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
