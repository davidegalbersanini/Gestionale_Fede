'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Client } from '@/types';

interface ClientAutocompleteProps {
  clients: Client[];
  firstName: string;
  lastName: string;
  onFirstNameChange: (val: string) => void;
  onLastNameChange: (val: string) => void;
  onSelectClient: (client: Client) => void;
  firstNameRequired?: boolean;
  firstNameLabel?: React.ReactNode;
  lastNameLabel?: React.ReactNode;
  firstNamePlaceholder?: string;
  lastNamePlaceholder?: string;
  accent?: 'rose' | 'pink' | 'amber';
}

export default function ClientAutocomplete({
  clients,
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
  onSelectClient,
  firstNameRequired = false,
  firstNameLabel = 'Nome',
  lastNameLabel = 'Cognome',
  firstNamePlaceholder = 'es. Laura',
  lastNamePlaceholder = 'es. Rossi',
  accent = 'rose',
}: ClientAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filteredClients = useMemo(() => {
    const query = `${firstName} ${lastName}`.trim().toLowerCase();
    if (!query) return [];
    const firstLower = firstName.trim().toLowerCase();
    const lastLower = lastName.trim().toLowerCase();
    return clients
      .filter(c => {
        const full = (c.full_name || '').toLowerCase();
        const cFirst = (c.first_name || '').toLowerCase();
        const cLast = (c.last_name || '').toLowerCase();
        return (
          full.includes(query) ||
          (firstLower && cFirst.includes(firstLower)) ||
          (lastLower && cLast.includes(lastLower))
        );
      })
      .slice(0, 5);
  }, [clients, firstName, lastName]);

  const ringClass =
    accent === 'pink'
      ? 'focus:ring-pink-400'
      : accent === 'amber'
      ? 'focus:ring-amber-400'
      : 'focus:ring-rose-400';

  const labelColorClass =
    accent === 'pink' ? 'text-pink-700' : 'text-stone-600';

  const hoverItemClass =
    accent === 'pink'
      ? 'hover:bg-pink-50'
      : accent === 'amber'
      ? 'hover:bg-amber-50'
      : 'hover:bg-rose-50';

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          {firstNameLabel && (
            <label className={`block text-xs font-semibold ${labelColorClass} uppercase tracking-wider mb-1.5`}>
              {firstNameLabel}
            </label>
          )}
          <input
            type="text"
            required={firstNameRequired}
            placeholder={firstNamePlaceholder}
            value={firstName}
            onChange={e => {
              onFirstNameChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className={`w-full bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
          />
        </div>

        <div className="min-w-0">
          {lastNameLabel && (
            <label className={`block text-xs font-semibold ${labelColorClass} uppercase tracking-wider mb-1.5`}>
              {lastNameLabel}
            </label>
          )}
          <input
            type="text"
            placeholder={lastNamePlaceholder}
            value={lastName}
            onChange={e => {
              onLastNameChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className={`w-full bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 ${ringClass} text-sm`}
          />
        </div>
      </div>

      {showSuggestions && filteredClients.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden z-20">
          {filteredClients.map(c => (
            <button
              type="button"
              key={c.id}
              onClick={() => {
                onSelectClient(c);
                setShowSuggestions(false);
              }}
              className={`w-full px-4 py-2.5 text-left ${hoverItemClass} text-stone-700 text-sm flex items-center justify-between gap-2 min-w-0 border-b border-stone-100 last:border-0`}
            >
              <div className="min-w-0 truncate">
                <span className="font-bold text-stone-900">{c.first_name || c.full_name}</span>
                {c.last_name && c.last_name !== '-' && (
                  <span className="text-stone-600 ml-1.5">{c.last_name}</span>
                )}
              </div>
              {c.phone && <span className="text-stone-500 text-xs shrink-0">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
