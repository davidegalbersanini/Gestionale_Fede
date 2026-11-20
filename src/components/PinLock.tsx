'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Delete, Loader2 } from 'lucide-react';

interface PinLockProps {
  onSuccess: () => void;
}

export default function PinLock({ onSuccess }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  const verifyPin = useCallback(
    async (candidate: string) => {
      setIsVerifying(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/auth/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: candidate, rememberDevice }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.authenticated) {
          onSuccess();
          return;
        }

        setErrorMessage(data.error || 'PIN non corretto. Riprova.');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(200);
        }
        setTimeout(() => {
          setPin('');
        }, 450);
      } catch {
        setErrorMessage('Errore di connessione. Riprova.');
        setPin('');
      } finally {
        setIsVerifying(false);
      }
    },
    [onSuccess, rememberDevice]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (isVerifying) return;
      setPin(prev => {
        if (prev.length >= 4) return prev;
        const nextPin = prev + digit;
        setErrorMessage(null);

        if (nextPin.length === 4) {
          void verifyPin(nextPin);
        }
        return nextPin;
      });
    },
    [isVerifying, verifyPin]
  );

  const handleDelete = useCallback(() => {
    if (isVerifying) return;
    setPin(prev => prev.slice(0, -1));
    setErrorMessage(null);
  }, [isVerifying]);

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

  const hasError = Boolean(errorMessage);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-rose-50/70 via-stone-50 to-stone-100 text-stone-900 p-4 select-none flex items-center justify-center">
      <div className="w-full max-w-sm flex flex-col items-center my-auto py-4">
        {/* Header with Brand Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-16 px-4 rounded-3xl bg-white border border-stone-200 flex items-center justify-center shadow-lg shadow-rose-200/50 mb-3.5">
            <img src="/logo.png" alt="Gestionale Fede" className="h-10 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 mb-0.5">Gestionale Fede</h1>
          <p className="text-xs text-rose-600 font-semibold tracking-wide uppercase">
            PMU & Eventi • Beauty Management
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex flex-col items-center mb-6 min-h-[44px]">
          <div className={`flex gap-4 mb-2 transition-transform ${hasError ? 'animate-bounce text-red-500' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  pin.length > i
                    ? 'bg-rose-500 border-rose-500 scale-110 shadow-md shadow-rose-300'
                    : 'border-stone-300 bg-white'
                } ${hasError ? '!border-red-500 !bg-red-500' : ''}`}
              />
            ))}
          </div>
          {isVerifying ? (
            <span className="text-rose-600 text-xs font-medium flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifica PIN...
            </span>
          ) : errorMessage ? (
            <span className="text-red-600 text-xs font-medium text-center animate-fade-in">
              {errorMessage}
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
              disabled={isVerifying}
              onClick={() => handleDigit(d)}
              className="w-16 h-16 mx-auto rounded-full bg-white hover:bg-rose-50 active:bg-rose-600 active:text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center text-xl sm:text-2xl font-semibold text-stone-800 shadow-sm border border-stone-200 hover:border-rose-300"
            >
              {d}
            </button>
          ))}

          <div className="w-16 h-16" />

          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigit('0')}
            className="w-16 h-16 mx-auto rounded-full bg-white hover:bg-rose-50 active:bg-rose-600 active:text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center text-xl sm:text-2xl font-semibold text-stone-800 shadow-sm border border-stone-200 hover:border-rose-300"
          >
            0
          </button>

          <button
            type="button"
            disabled={isVerifying}
            onClick={handleDelete}
            aria-label="Cancella cifra"
            className="w-16 h-16 mx-auto rounded-full bg-transparent hover:bg-stone-200/70 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center text-stone-500 hover:text-stone-900"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Remember toggle */}
        <label className="flex items-center gap-2 text-stone-600 text-xs cursor-pointer select-none hover:text-stone-900">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={e => setRememberDevice(e.target.checked)}
            className="rounded border-stone-300 bg-white text-rose-500 focus:ring-0"
          />
          <span>Resta autenticata su questo dispositivo (30 giorni)</span>
        </label>
      </div>
    </div>
  );
}
