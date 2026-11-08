'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Delete, Sparkles, CheckCircle2 } from 'lucide-react';

interface PinLockProps {
  correctPin: string;
  onSuccess: () => void;
}

export default function PinLock({ correctPin, onSuccess }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  // Check if session was already saved
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fede_auth_session');
      if (saved === 'authorized') {
        onSuccess();
      }
    }
  }, [onSuccess]);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        if (nextPin === correctPin || correctPin === '1234' && nextPin === '1234') {
          if (rememberDevice && typeof window !== 'undefined') {
            localStorage.setItem('fede_auth_session', 'authorized');
          }
          setTimeout(() => onSuccess(), 150);
        } else {
          setError(true);
          if (navigator.vibrate) navigator.vibrate(200);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 600);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-stone-900 via-stone-950 to-black text-white p-6 select-none">
      {/* Header */}
      <div className="pt-12 flex flex-col items-center">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-900/40 mb-4 animate-pulse">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Gestionale Fede</h1>
        <p className="text-stone-400 text-sm">Inserisci il PIN per accedere ai dati</p>
      </div>

      {/* PIN Dots */}
      <div className="flex flex-col items-center my-6">
        <div className={`flex gap-5 mb-3 transition-transform ${error ? 'animate-bounce text-red-500' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                pin.length > i
                  ? 'bg-rose-500 border-rose-500 scale-110 shadow-lg shadow-rose-500/50'
                  : 'border-stone-600 bg-transparent'
              } ${error ? '!border-red-500 !bg-red-500' : ''}`}
            />
          ))}
        </div>
        {error && (
          <span className="text-red-400 text-xs font-medium animate-fade-in">
            PIN non corretto. Riprova.
          </span>
        )}
      </div>

      {/* Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-4 pb-8">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            onClick={() => handleDigit(d)}
            className="w-20 h-20 mx-auto rounded-full bg-stone-800/80 hover:bg-stone-700 active:bg-rose-600 active:scale-95 transition-all flex items-center justify-center text-2xl font-medium text-white shadow-md border border-stone-700/50"
          >
            {d}
          </button>
        ))}

        <div className="w-20 h-20" />

        <button
          onClick={() => handleDigit('0')}
          className="w-20 h-20 mx-auto rounded-full bg-stone-800/80 hover:bg-stone-700 active:bg-rose-600 active:scale-95 transition-all flex items-center justify-center text-2xl font-medium text-white shadow-md border border-stone-700/50"
        >
          0
        </button>

        <button
          onClick={handleDelete}
          className="w-20 h-20 mx-auto rounded-full bg-transparent hover:bg-stone-800/50 active:scale-95 transition-all flex items-center justify-center text-stone-400 hover:text-white"
        >
          <Delete className="w-7 h-7" />
        </button>
      </div>

      {/* Remember toggle */}
      <label className="flex items-center gap-2 text-stone-400 text-xs cursor-pointer pb-4">
        <input
          type="checkbox"
          checked={rememberDevice}
          onChange={e => setRememberDevice(e.target.checked)}
          className="rounded border-stone-700 bg-stone-800 text-rose-500 focus:ring-0"
        />
        <span>Resta collegata su questo dispositivo</span>
      </label>
    </div>
  );
}

