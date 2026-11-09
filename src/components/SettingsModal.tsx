'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings, Location } from '@/types';
import { DataService } from '@/lib/storage';
import { checkGoogleCalendarStatus, startGoogleCalendarConnect, disconnectGoogleCalendar } from '@/lib/calendar';
import {
  Settings as SettingsIcon,
  X,
  Lock,
  Download,
  Target,
  LogOut,
  MapPin,
  Plus,
  Trash2,
  Check,
  Calendar as CalendarIcon,
  RefreshCw,
  ExternalLink,
  Edit2
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
  const [yearlyTarget, setYearlyTarget] = useState(String(settings.yearly_target || 35000));

  // New location form
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocColor, setNewLocColor] = useState('#ec4899');
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editingLocAddress, setEditingLocAddress] = useState('');

  const [isSaved, setIsSaved] = useState(false);

  // Google Calendar state
  const [gcalStatus, setGcalStatus] = useState<{ connected: boolean; email?: string }>({ connected: false });
  const [isGcalLoading, setIsGcalLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkGoogleCalendarStatus().then(setGcalStatus);
    }
  }, [isOpen]);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppSettings = {
      ...settings,
      pin_hash: pin.trim() || '1234',
      yearly_target: parseFloat(yearlyTarget) || 35000,
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
      address: newLocAddress.trim() || undefined,
      color: newLocColor,
      active: true,
    };
    const updated = [...locations, newLoc];
    onUpdateLocations(updated);
    DataService.saveLocations(updated);
    setNewLocName('');
    setNewLocAddress('');
  };

  const handleUpdateLocationAddress = (id: string, address: string) => {
    const updated = locations.map(l => (l.id === id ? { ...l, address: address.trim() || undefined } : l));
    onUpdateLocations(updated);
    DataService.saveLocations(updated);
    setEditingLocId(null);
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
            <h2 className="text-lg font-bold text-white">Impostazioni</h2>
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

          {/* Target Annuo (Solo annuale come richiesto) */}
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
              <p className="text-[11px] text-stone-500 mt-1">
                La media mensile verrà calcolata in automatico sui mesi effettivamente trascorsi.
              </p>
            </div>
          </div>

          {/* Sedi Management con Indirizzo Google Maps */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Sedi di Lavoro & Google Maps
            </h3>
            <p className="text-[11px] text-stone-400">
              A ogni luogo di lavoro puoi associare un indirizzo fisico cliccabile su Google Maps e sincronizzato sul calendario.
            </p>

            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="p-3 bg-stone-800/60 rounded-xl border border-stone-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: loc.color }} />
                      <span className="text-sm font-semibold text-white">{loc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocId(editingLocId === loc.id ? null : loc.id);
                          setEditingLocAddress(loc.address || '');
                        }}
                        className="text-stone-400 hover:text-white p-1"
                        title="Modifica indirizzo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="text-stone-500 hover:text-red-400 p-1"
                        title="Elimina sede"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Address display or edit */}
                  {editingLocId === loc.id ? (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Indirizzo (es. Via Garibaldi 10, Milano)..."
                        value={editingLocAddress}
                        onChange={e => setEditingLocAddress(e.target.value)}
                        className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateLocationAddress(loc.id, editingLocAddress)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                      >
                        Salva
                      </button>
                    </div>
                  ) : loc.address ? (
                    <div className="flex items-center justify-between text-xs text-stone-300 bg-stone-900/60 px-2.5 py-1.5 rounded-lg border border-stone-800">
                      <span className="truncate flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0" />
                        <span className="truncate">{loc.address}</span>
                      </span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-rose-400 hover:text-rose-300 ml-2 font-semibold flex items-center gap-1 flex-shrink-0"
                      >
                        Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-500 italic">Nessun indirizzo specificato (clicca la matita per aggiungerlo)</p>
                  )}
                </div>
              ))}

              {/* Add Location Form */}
              <div className="p-3 bg-stone-800/40 rounded-xl border border-dashed border-stone-700 space-y-2">
                <span className="text-xs font-bold text-stone-300 block">Aggiungi Nuova Sede</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome sede (es. Studio Monza)..."
                    value={newLocName}
                    onChange={e => setNewLocName(e.target.value)}
                    className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="color"
                    value={newLocColor}
                    onChange={e => setNewLocColor(e.target.value)}
                    className="w-10 h-8 rounded-xl bg-transparent cursor-pointer border border-stone-700"
                    title="Colore identificativo"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Indirizzo completo (Via, Civico, Città)..."
                    value={newLocAddress}
                    onChange={e => setNewLocAddress(e.target.value)}
                    className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddLocation}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Aggiungi
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Google Calendar Automatic Sync */}
          <div className="space-y-3 p-4 bg-stone-800/40 rounded-2xl border border-stone-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" /> Google Calendar (Sincronizzazione)
              </h3>
              {gcalStatus.connected && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Attivo
                </span>
              )}
            </div>

            <p className="text-[11px] text-stone-400">
              Sincronizza automaticamente appuntamenti, orari e indirizzi sul tuo account Google Calendar personale.
            </p>

            {gcalStatus.connected ? (
              <div className="flex items-center justify-between bg-stone-900/60 p-3 rounded-xl border border-stone-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{gcalStatus.email}</p>
                    <p className="text-[10px] text-emerald-400/90 font-medium">Sincronizzazione automatica attiva</p>
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
                    <CalendarIcon className="w-4 h-4" /> Connetti con Google Calendar
                  </>
                )}
              </button>
            )}
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
