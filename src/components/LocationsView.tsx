'use client';

import React, { useState } from 'react';
import { Location, ServicePrice } from '@/types';
import {
  Store,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  DollarSign,
  Tag,
  Check,
  X,
  Sparkles
} from 'lucide-react';

interface LocationsViewProps {
  locations: Location[];
  servicePrices: ServicePrice[];
  onUpdateLocations: (locations: Location[]) => void;
  onSaveLocation?: (location: Location) => void;
  onDeleteLocationProp?: (id: string) => void;
  onSaveServicePrice: (item: Partial<ServicePrice> & { location_id: string; name: string; price: number }) => void;
  onDeleteServicePrice: (id: string) => void;
}

export default function LocationsView({
  locations,
  servicePrices,
  onUpdateLocations,
  onSaveLocation,
  onDeleteLocationProp,
  onSaveServicePrice,
  onDeleteServicePrice,
}: LocationsViewProps) {
  // New Location Form State
  const [isAddingLoc, setIsAddingLoc] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocColor, setNewLocColor] = useState('#ec4899');

  // Edit Location State
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editingLocName, setEditingLocName] = useState('');
  const [editingLocAddress, setEditingLocAddress] = useState('');
  const [editingLocColor, setEditingLocColor] = useState('#ec4899');

  // New Service Form State (per location)
  const [addingServiceLocId, setAddingServiceLocId] = useState<string | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');

  // Edit Service State
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceName, setEditingServiceName] = useState('');
  const [editingServicePrice, setEditingServicePrice] = useState('');

  // Handle Add Location
  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    const newLoc: Location = {
      id: `loc-${Date.now()}`,
      name: newLocName.trim(),
      address: newLocAddress.trim() || undefined,
      color: newLocColor,
      active: true,
    };

    if (onSaveLocation) {
      onSaveLocation(newLoc);
    } else {
      onUpdateLocations([...locations, newLoc]);
    }
    setNewLocName('');
    setNewLocAddress('');
    setIsAddingLoc(false);
  };

  // Handle Update Location
  const handleSaveEditLocation = (id: string) => {
    if (!editingLocName.trim()) return;
    const existing = locations.find(l => l.id === id);
    const updatedLoc: Location = {
      id,
      name: editingLocName.trim(),
      address: editingLocAddress.trim() || undefined,
      color: editingLocColor || existing?.color || '#ec4899',
      active: existing?.active ?? true,
    };

    if (onSaveLocation) {
      onSaveLocation(updatedLoc);
    } else {
      const updated = locations.map(l => (l.id === id ? updatedLoc : l));
      onUpdateLocations(updated);
    }
    setEditingLocId(null);
  };

  // Handle Delete Location
  const handleDeleteLocation = (id: string) => {
    if (locations.length <= 1) {
      alert('Devi mantenere almeno una sede attiva.');
      return;
    }
    if (confirm('Sei sicura di voler eliminare questa sede? I trattamenti associati non saranno più visibili per questa sede.')) {
      if (onDeleteLocationProp) {
        onDeleteLocationProp(id);
      } else {
        const updated = locations.filter(l => l.id !== id);
        onUpdateLocations(updated);
      }
    }
  };

  // Handle Add Service Price
  const handleAddService = (locId: string) => {
    if (!newServiceName.trim() || !newServicePrice) return;
    onSaveServicePrice({
      location_id: locId,
      name: newServiceName.trim(),
      price: parseFloat(newServicePrice) || 0,
    });
    setNewServiceName('');
    setNewServicePrice('');
    setAddingServiceLocId(null);
  };

  // Handle Edit Service Price
  const handleSaveEditService = (item: ServicePrice) => {
    if (!editingServiceName.trim() || !editingServicePrice) return;
    onSaveServicePrice({
      id: item.id,
      location_id: item.location_id,
      name: editingServiceName.trim(),
      price: parseFloat(editingServicePrice) || 0,
    });
    setEditingServiceId(null);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-4 sm:p-5 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Store className="w-6 h-6 text-rose-500" />
            Sedi & Listino Prezzi
          </h1>
          <p className="text-stone-400 text-xs mt-0.5">
            Gestisci le tue sedi di lavoro e imposta il listino trattamenti personalizzato per ciascuna
          </p>
        </div>

        <button
          onClick={() => setIsAddingLoc(true)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuova Sede</span>
        </button>
      </div>

      {/* Add New Location Card Form */}
      {isAddingLoc && (
        <form
          onSubmit={handleAddLocation}
          className="p-5 bg-stone-900 border border-rose-500/40 rounded-3xl space-y-4 shadow-lg animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              Aggiungi Nuova Sede
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingLoc(false)}
              className="text-stone-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                Nome Sede *
              </label>
              <input
                type="text"
                required
                placeholder="es. Studio Milano, Lissone..."
                value={newLocName}
                onChange={e => setNewLocName(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                Indirizzo (Google Maps)
              </label>
              <input
                type="text"
                placeholder="Via Garibaldi 10, Milano..."
                value={newLocAddress}
                onChange={e => setNewLocAddress(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-stone-400 uppercase mb-1">
                  Colore
                </label>
                <div className="flex items-center gap-2 bg-stone-800 border border-stone-700 rounded-xl px-2.5 py-1.5">
                  <input
                    type="color"
                    value={newLocColor}
                    onChange={e => setNewLocColor(e.target.value)}
                    className="w-6 h-6 rounded-lg bg-transparent border-0 cursor-pointer p-0"
                  />
                  <span className="text-xs font-mono text-stone-300">{newLocColor}</span>
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md mt-auto h-[38px]"
              >
                Crea
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Locations and their Price Lists */}
      <div className="space-y-6">
        {locations.map(loc => {
          const locServices = servicePrices.filter(sp => sp.location_id === loc.id);
          const isEditingThisLoc = editingLocId === loc.id;
          const isAddingService = addingServiceLocId === loc.id;

          return (
            <div
              key={loc.id}
              className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-sm transition-all"
            >
              {/* Location Header Bar */}
              <div className="p-4 sm:p-5 bg-stone-900/90 border-b border-stone-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {isEditingThisLoc ? (
                  /* Edit Location Form */
                  <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingLocColor}
                        onChange={e => setEditingLocColor(e.target.value)}
                        className="w-8 h-8 rounded-xl bg-transparent border-0 cursor-pointer p-0"
                        title="Cambia colore sede"
                      />
                      <input
                        type="text"
                        value={editingLocName}
                        onChange={e => setEditingLocName(e.target.value)}
                        placeholder="Nome sede"
                        className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-sm text-white font-bold"
                      />
                    </div>
                    <input
                      type="text"
                      value={editingLocAddress}
                      onChange={e => setEditingLocAddress(e.target.value)}
                      placeholder="Indirizzo (opzionale)"
                      className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleSaveEditLocation(loc.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Salva
                      </button>
                      <button
                        onClick={() => setEditingLocId(null)}
                        className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Location Info */
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: loc.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-bold text-white truncate">
                            {loc.name}
                          </h2>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 border border-stone-700/60 flex-shrink-0">
                            {locServices.length} {locServices.length === 1 ? 'trattamento' : 'trattamenti'}
                          </span>
                        </div>
                        {loc.address ? (
                          <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0" />
                            <span className="truncate">{loc.address}</span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-rose-400 hover:text-rose-300 ml-1 font-semibold flex items-center gap-0.5"
                            >
                              Maps <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        ) : (
                          <p className="text-[11px] text-stone-500 italic mt-0.5">Nessun indirizzo impostato</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingLocId(loc.id);
                          setEditingLocName(loc.name);
                          setEditingLocAddress(loc.address || '');
                          setEditingLocColor(loc.color || '#ec4899');
                        }}
                        className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
                        title="Modifica sede"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="p-2 rounded-xl bg-stone-800 hover:bg-red-950/40 text-stone-400 hover:text-red-400 transition-colors"
                        title="Elimina sede"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Price List Section */}
              <div className="p-4 sm:p-5 space-y-3 bg-stone-900/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-400" />
                    Listino Trattamenti per {loc.name}
                  </span>

                  {!isAddingService && (
                    <button
                      onClick={() => {
                        setAddingServiceLocId(loc.id);
                        setNewServiceName('');
                        setNewServicePrice('');
                      }}
                      className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-stone-700 text-rose-400 hover:text-rose-300 border border-stone-700/60 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Aggiungi Trattamento</span>
                    </button>
                  )}
                </div>

                {/* Form Add Service in this location */}
                {isAddingService && (
                  <div className="p-3.5 rounded-2xl bg-stone-800/80 border border-rose-500/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Nome trattamento (es. Sopracciglia Pixel, Eye-liner)..."
                      value={newServiceName}
                      onChange={e => setNewServiceName(e.target.value)}
                      className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <div className="flex items-center gap-2">
                      <div className="relative w-28">
                        <input
                          type="number"
                          placeholder="Prezzo (€)"
                          value={newServicePrice}
                          onChange={e => setNewServicePrice(e.target.value)}
                          className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-3 pr-6 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                          €
                        </span>
                      </div>
                      <button
                        onClick={() => handleAddService(loc.id)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Aggiungi
                      </button>
                      <button
                        onClick={() => setAddingServiceLocId(null)}
                        className="px-2.5 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl text-xs"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}

                {/* Service List Grid */}
                {locServices.length === 0 ? (
                  <div className="py-6 text-center text-stone-500 text-xs border border-dashed border-stone-800 rounded-2xl bg-stone-900/20">
                    Nessun trattamento nel listino per questa sede.
                    <div className="mt-1.5">
                      <button
                        onClick={() => setAddingServiceLocId(loc.id)}
                        className="text-rose-400 hover:underline font-semibold"
                      >
                        + Aggiungi il primo trattamento
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {locServices.map(srv => {
                      const isEditingThisService = editingServiceId === srv.id;

                      if (isEditingThisService) {
                        return (
                          <div
                            key={srv.id}
                            className="p-3 bg-stone-800 border border-stone-700 rounded-2xl space-y-2"
                          >
                            <input
                              type="text"
                              value={editingServiceName}
                              onChange={e => setEditingServiceName(e.target.value)}
                              className="w-full bg-stone-900 border border-stone-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                            />
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  value={editingServicePrice}
                                  onChange={e => setEditingServicePrice(e.target.value)}
                                  className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-2.5 pr-6 py-1.5 text-xs text-white"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-400 font-bold">
                                  €
                                </span>
                              </div>
                              <button
                                onClick={() => handleSaveEditService(srv)}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                              >
                                Salva
                              </button>
                              <button
                                onClick={() => setEditingServiceId(null)}
                                className="px-2 py-1.5 bg-stone-700 text-stone-300 rounded-xl text-xs"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={srv.id}
                          className="px-3.5 py-2.5 bg-stone-800/60 hover:bg-stone-800 border border-stone-700/50 rounded-2xl flex items-center justify-between gap-2 group transition-all shadow-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-white truncate block">
                              {srv.name}
                            </span>
                            <span className="text-xs font-bold text-emerald-400">
                              {srv.price} €
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingServiceId(srv.id);
                                setEditingServiceName(srv.name);
                                setEditingServicePrice(String(srv.price));
                              }}
                              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-700 transition-colors"
                              title="Modifica prezzo"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Rimuovere "${srv.name}" dal listino di ${loc.name}?`)) {
                                  onDeleteServicePrice(srv.id);
                                }
                              }}
                              className="p-1 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-700 transition-colors"
                              title="Rimuovi trattamento"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

