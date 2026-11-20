'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings } from '@/types';
import { DataService } from '@/lib/storage';
import { checkGoogleCalendarStatus, startGoogleCalendarConnect, disconnectGoogleCalendar } from '@/lib/calendar';
import {
  Settings as SettingsIcon,
  X,
  Lock,
  Target,
  LogOut,
  Check,
  Cloud,
  RefreshCw,
  Download,
  AlertCircle,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onLockApp: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onLockApp,
}: SettingsModalProps) {
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [yearlyTarget, setYearlyTarget] = useState(String(settings.yearly_target || 35000));
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Google Calendar state
  const [gcalStatus, setGcalStatus] = useState<{ connected: boolean; email?: string }>({ connected: false });
  const [isGcalLoading, setIsGcalLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewPin('');
      setYearlyTarget(String(settings.yearly_target || 35000));
      setPinError(null);
      setIsSaved(false);
      checkGoogleCalendarStatus().then(setGcalStatus);
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleConnectGoogle = async () => {
    setIsGcalLoading(true);
    await startGoogleCalendarConnect();
  };

  const handleDisconnectGoogle = async () => {
    setIsGcalLoading(true);
    await disconnectGoogleCalendar();
    setGcalStatus({ connected: false });
    setIsGcalLoading(false);
  };

  const handleDownloadBackup = () => {
    const json = DataService.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestionale-fede-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (newPin.length > 0 && !/^\d{4}$/.test(newPin)) {
      setPinError('Il nuovo PIN deve essere composto esattamente da 4 cifre numeriche.');
      return;
    }

    setIsSaving(true);
    try {
      if (newPin.length === 4) {
        const res = await fetch('/api/auth/pin', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPin }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setPinError(data.error || 'Impossibile aggiornare il PIN sul server.');
          setIsSaving(false);
          return;
        }
      }

      const updated: AppSettings = {
        ...settings,
        pin_hash: '',
        yearly_target: parseFloat(yearlyTarget) || 35000,
      };
      onUpdateSettings(updated);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 600);
    } catch {
      setPinError('Errore di rete durante il salvataggio del PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-stone-900/95 backdrop-blur-md px-6 py-4 border-b border-stone-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-white">Impostazioni</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* PIN Lock Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Sicurezza & PIN di Accesso
            </h3>
            <div>
              <label className="block text-xs text-stone-400 mb-1">
                Cambia PIN a 4 cifre (lascia vuoto per mantenere quello attuale)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={newPin}
                onChange={e => {
                  setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setPinError(null);
                }}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-white text-base tracking-widest font-mono placeholder-stone-600"
              />
              {pinError && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{pinError}</span>
                </p>
              )}
            </div>
          </div>

          {/* Target Annuo */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Target Fatturato Annuale
            </h3>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Obiettivo Annuo Complessivo (€)</label>
              <input
                type="number"
                value={yearlyTarget}
                onChange={e => setYearlyTarget(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white text-sm"
              />
            </div>
          </div>

          {/* Google Account Integration */}
          <div className="space-y-3 p-4 bg-stone-800/40 rounded-2xl border border-stone-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud className="w-4 h-4" /> Account Google
              </h3>
              {gcalStatus.connected && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Attivo
                </span>
              )}
            </div>

            {gcalStatus.connected ? (
              <div className="flex items-center justify-between bg-stone-900/60 p-3 rounded-xl border border-stone-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{gcalStatus.email}</p>
                    <p className="text-[10px] text-emerald-400/90 font-medium">Sincronizzazione calendario & Drive attiva</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  disabled={isGcalLoading}
                  className="px-2.5 py-1 text-[11px] text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg transition-colors"
                >
                  {isGcalLoading ? 'Disconnessione...' : 'Disconnetti'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isGcalLoading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-[0.98] transition-all rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-sky-900/30"
              >
                {isGcalLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Connessione in corso...
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" /> Connetti Account Google
                  </>
                )}
              </button>
            )}
          </div>

          {/* Backup & Lock Actions */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/80 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Scarica Backup Completo (JSON)
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch('/api/auth/pin', { method: 'DELETE' });
                } catch {
                  // ignore
                }
                DataService.clearLocalCache();
                onLockApp();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-stone-800/50 hover:bg-red-950/40 text-stone-400 hover:text-red-400 text-xs font-medium flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Blocca Schermo Ora (Richiedi PIN)
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Salvataggio...
              </>
            ) : isSaved ? (
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
