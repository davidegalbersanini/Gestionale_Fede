'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Delete } from 'lucide-react';

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

  const handleDigit = useCallback((digit: string) => {
    setPin(prev => {
      if (prev.length >= 4) return prev;
      const nextPin = prev + digit;
      setError(false);

      if (nextPin.length === 4) {
        if (nextPin === correctPin || (correctPin === '1234' && nextPin === '1234')) {
          if (rememberDevice && typeof window !== 'undefined') {
            localStorage.setItem('fede_auth_session', 'authorized');
          }
          setTimeout(() => onSuccess(), 120);
        } else {
          setError(true);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(200);
          }
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 600);
        }
      }
      return nextPin;
    });
  }, [correctPin, onSuccess, rememberDevice]);

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  }, []);

  // Physical keyboard listener for PC / Mac
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-stone-900 via-stone-950 to-black text-white p-4 select-none flex items-center justify-center">
      <div className="w-full max-w-sm flex flex-col items-center my-auto py-4">
        {/* Header with Luxury Brand Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-stone-900/90 border border-stone-800 flex items-center justify-center p-2.5 shadow-2xl shadow-rose-950/40 mb-3.5">
            <img src="/logo.svg" alt="Gestionale Fede" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-0.5">Gestionale Fede</h1>
          <p className="text-xs text-rose-300 font-medium tracking-wide uppercase">
            PMU & Eventi • Beauty Management
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex flex-col items-center mb-6">
          <div className={`flex gap-4 mb-2 transition-transform ${error ? 'animate-bounce text-red-500' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  pin.length > i
                    ? 'bg-rose-500 border-rose-500 scale-110 shadow-lg shadow-rose-500/50'
                    : 'border-stone-600 bg-transparent'
                } ${error ? '!border-red-500 !bg-red-500' : ''}`}
              />
            ))}
          </div>
          {error ? (
            <span className="text-red-400 text-xs font-medium animate-fade-in">
              PIN non corretto. Riprova.
            </span>
          ) : (
            <span className="text-stone-500 text-xs select-none">Inserisci il PIN a 4 cifre</span>
          )}
        </div>

        {/* Keypad */}
        <div className="w-full max-w-[280px] grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="w-16 h-16 mx-auto rounded-full bg-stone-800/80 hover:bg-stone-700 active:bg-rose-600 active:scale-95 transition-all flex items-center justify-center text-xl sm:text-2xl font-medium text-white shadow-md border border-stone-700/50 hover:border-stone-500"
            >
              {d}
            </button>
          ))}

          <div className="w-16 h-16" />

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="w-16 h-16 mx-auto rounded-full bg-stone-800/80 hover:bg-stone-700 active:bg-rose-600 active:scale-95 transition-all flex items-center justify-center text-xl sm:text-2xl font-medium text-white shadow-md border border-stone-700/50 hover:border-stone-500"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            aria-label="Cancella cifra"
            className="w-16 h-16 mx-auto rounded-full bg-transparent hover:bg-stone-800/50 active:scale-95 transition-all flex items-center justify-center text-stone-400 hover:text-white"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Remember toggle */}
        <label className="flex items-center gap-2 text-stone-400 text-xs cursor-pointer select-none hover:text-stone-300">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={e => setRememberDevice(e.target.checked)}
            className="rounded border-stone-700 bg-stone-800 text-rose-500 focus:ring-0"
          />
          <span>Resta autenticata su questo dispositivo</span>
        </label>
      </div>
    </div>
  );
}
