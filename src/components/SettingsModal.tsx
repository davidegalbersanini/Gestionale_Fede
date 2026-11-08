'use client';

import React, { useState } from 'react';
import { AppSettings, Location } from '@/types';
import { DataService } from '@/lib/storage';
import {
  Settings as SettingsIcon,
  X,
  Lock,
  Download,
  Database,
  Target,
  LogOut,
  MapPin,
  Plus,
  Trash2,
  Check
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  locations: Location[];
  onUpdateLocations: (newLocations: Location[]) => void;
  onLockApp: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  locations,
  onUpdateLocations,
  onLockApp,
}: SettingsModalProps) {
  const [pin, setPin] = useState(settings.pin_hash || '1234');
  const [monthlyTarget, setMonthlyTarget] = useState(String(settings.monthly_target || 2700));
  const [yearlyTarget, setYearlyTarget] = useState(String(settings.yearly_target || 35000));
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabase_url || '');
  const [supabaseKey, setSupabaseKey] = useState(settings.supabase_anon_key || '');

  // New location form
  const [newLocName, setNewLocName] = useState('');
  const [newLocColor, setNewLocColor] = useState('#ec4899');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppSettings = {
      ...settings,
      pin_hash: pin.trim() || '1234',
      monthly_target: parseFloat(monthlyTarget) || 2700,
      yearly_target: parseFloat(yearlyTarget) || 35000,
      supabase_url: supabaseUrl.trim(),
      supabase_anon_key: supabaseKey.trim(),
    };
    onUpdateSettings(updated);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleAddLocation = () => {
    if (!newLocName.trim()) return;
    const newLoc: Location = {
      id: `loc-${Date.now()}`,
      name: newLocName.trim(),
      color: newLocColor,
      active: true,
    };
    const updated = [...locations, newLoc];
    onUpdateLocations(updated);
    DataService.saveLocations(updated);
    setNewLocName('');
  };

  const handleDeleteLocation = (id: string) => {
    if (locations.length <= 1) {
      alert('Devi mantenere almeno una sede attiva.');
      return;
    }
    const updated = locations.filter(l => l.id !== id);
    onUpdateLocations(updated);
    DataService.saveLocations(updated);
  };

  const handleExportBackup = () => {
    const jsonStr = DataService.exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestionale-fede-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-stone-900/95 backdrop-blur-md px-6 py-4 border-b border-stone-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-white">Impostazioni & Cloud</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* PIN Lock Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Sicurezza & PIN di Accesso
            </h3>
            <div>
              <label className="block text-xs text-stone-400 mb-1">
                PIN di sblocco a 4 cifre
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-white text-base tracking-widest font-mono"
              />
            </div>
          </div>

          {/* Targets Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Target & Obiettivo Range Rover
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Obiettivo Mese (€)</label>
                <input
                  type="number"
                  value={monthlyTarget}
                  onChange={e => setMonthlyTarget(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Obiettivo Anno (€)</label>
                <input
                  type="number"
                  value={yearlyTarget}
                  onChange={e => setYearlyTarget(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Sedi Management */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Sedi di Lavoro Configurate
            </h3>
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center justify-between p-2.5 bg-stone-800/60 rounded-xl border border-stone-700/60">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: loc.color }} />
                    <span className="text-sm font-medium text-white">{loc.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="text-stone-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add Location input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Nome nuova sede..."
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <input
                  type="color"
                  value={newLocColor}
                  onChange={e => setNewLocColor(e.target.value)}
                  className="w-10 h-8 rounded-xl bg-transparent cursor-pointer border border-stone-700"
                />
                <button
                  type="button"
                  onClick={handleAddLocation}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Aggiungi
                </button>
              </div>
            </div>
          </div>

          {/* Supabase Cloud Setup */}
          <div className="space-y-3 p-4 bg-stone-800/40 rounded-2xl border border-stone-700/50">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4" /> Supabase Cloud Sync
            </h3>
            <p className="text-[11px] text-stone-400">
              Inserisci i dati del tuo progetto Supabase per sincronizzare automaticamente il database cloud per l&apos;accesso da iPhone e PC.
            </p>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Project URL</label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={e => setSupabaseUrl(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Anon Public Key</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={e => setSupabaseKey(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
          </div>

          {/* Backup & Actions */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-rose-400" />
              Scarica Backup Completo (.JSON)
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('fede_auth_session');
                }
                onLockApp();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-stone-800/50 hover:bg-red-950/40 text-stone-400 hover:text-red-400 text-xs font-medium flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Blocca Schermo Ora (Richiedi PIN)
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" /> Impostazioni Salvate!
              </>
            ) : (
              'Salva Impostazioni'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

