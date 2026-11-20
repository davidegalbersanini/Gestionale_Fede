'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings, MasterSheetStatus } from '@/types';
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
  AlertCircle,
  FileSpreadsheet,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onLockApp: () => void;
  sheetStatus?: MasterSheetStatus | null;
  isSheetSyncing?: boolean;
  onSyncSheet?: () => void;
  onCreateMasterSheet?: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onLockApp,
  sheetStatus,
  isSheetSyncing = false,
  onSyncSheet,
  onCreateMasterSheet,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-stone-200 text-stone-900 rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden shadow-2xl flex flex-col">
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-4 border-b border-stone-200 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 min-w-0">
            <SettingsIcon className="w-5 h-5 text-rose-500 shrink-0" />
            <h2 className="text-lg font-bold text-stone-900 truncate">Impostazioni</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 pb-modal-safe space-y-6">
          {/* PIN Lock Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Sicurezza & PIN di Accesso
            </h3>
            <div>
              <label className="block text-xs text-stone-500 mb-1">
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
                className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2 text-stone-900 text-base tracking-widest font-mono placeholder-stone-400"
              />
              {pinError && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{pinError}</span>
                </p>
              )}
            </div>
          </div>

          {/* Target Annuo */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Target Fatturato Annuale
            </h3>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Obiettivo Annuo Complessivo (€)</label>
              <input
                type="number"
                value={yearlyTarget}
                onChange={e => setYearlyTarget(e.target.value)}
                className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 text-sm"
              />
            </div>
          </div>

          {/* Google Account Integration */}
          <div className="space-y-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud className="w-4 h-4" /> Account Google
              </h3>
              {gcalStatus.connected && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-600 border border-emerald-500/30">
                  Attivo
                </span>
              )}
            </div>

            {gcalStatus.connected ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-stone-200 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-900 truncate">{gcalStatus.email}</p>
                      <p className="text-[10px] text-emerald-700 font-medium">Sincronizzazione calendario & Foglio Google attiva</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={isGcalLoading}
                    className="px-2.5 py-1 text-[11px] text-stone-500 hover:text-red-600 hover:bg-stone-100 rounded-lg transition-colors shrink-0"
                  >
                    {isGcalLoading ? 'Disconnessione...' : 'Disconnetti'}
                  </button>
                </div>

                {/* Master Google Sheet Sub-Card */}
                <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-stone-800 truncate">Foglio Google Master</span>
                    </div>
                    {sheetStatus?.lastSyncedAt && (
                      <span className="text-[10px] text-stone-500 shrink-0">
                        {new Date(sheetStatus.lastSyncedAt).toLocaleString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {sheetStatus?.lastSyncSummary && (
                    <p className="text-[11px] text-stone-600 truncate">{sheetStatus.lastSyncSummary}</p>
                  )}

                  {sheetStatus?.lastSyncWarning && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{sheetStatus.lastSyncWarning}</span>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {sheetStatus?.spreadsheetUrl ? (
                      <a
                        href={sheetStatus.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[120px] py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>Apri Foglio</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={onCreateMasterSheet}
                        disabled={isSheetSyncing}
                        className="flex-1 min-w-[120px] py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                        <span>{isSheetSyncing ? 'Creazione...' : 'Crea Foglio Master'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onSyncSheet}
                      disabled={isSheetSyncing}
                      className="flex-1 min-w-[120px] py-2 px-3 rounded-lg bg-stone-100 hover:bg-stone-200 disabled:opacity-50 border border-stone-200 text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSheetSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSheetSyncing ? 'Sincronizzazione...' : 'Sincronizza ora'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isGcalLoading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-[0.98] transition-all rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-sky-200/60"
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

          {/* Lock Action */}
          <div className="pt-2 flex flex-col gap-2">
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
              className="w-full py-2.5 rounded-xl bg-stone-50 hover:bg-red-50 text-stone-500 hover:text-red-600 text-xs font-medium flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Blocca Schermo Ora (Richiedi PIN)
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-rose-200/70 flex items-center justify-center gap-2"
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
