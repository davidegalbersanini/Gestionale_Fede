'use client';

import React, { useMemo } from 'react';
import { GiftVoucher } from '@/types';
import { getVoucherInitialAmount, getVoucherRemainingAmount } from '@/lib/finance';
import { Gift } from 'lucide-react';

interface GiftVoucherSectionProps {
  vouchers: GiftVoucher[];
  usedGiftVoucher: boolean;
  selectedVoucherId: string;
  voucherDeduction: string;
  totalNum: number;
  clientSearchQuery: string;
  selectedClientId?: string;
  clientDisplayName: string;
  previouslyUsedVoucherId?: string;
  previouslyUsedAmount?: number;
  onChangeUsed: (used: boolean) => void;
  onChangeVoucherId: (voucherId: string) => void;
  onChangeDeduction: (deduction: string) => void;
}

export default function GiftVoucherSection({
  vouchers,
  usedGiftVoucher,
  selectedVoucherId,
  voucherDeduction,
  totalNum,
  clientSearchQuery,
  selectedClientId,
  clientDisplayName,
  previouslyUsedVoucherId,
  previouslyUsedAmount = 0,
  onChangeUsed,
  onChangeVoucherId,
  onChangeDeduction,
}: GiftVoucherSectionProps) {
  const getEffectiveRemaining = (v: GiftVoucher): number => {
    const baseRem = getVoucherRemainingAmount(v);
    if (previouslyUsedVoucherId && v.id === previouslyUsedVoucherId) {
      const initAmt = getVoucherInitialAmount(v);
      return Math.min(initAmt, baseRem + (Number(previouslyUsedAmount) || 0));
    }
    return baseRem;
  };

  const availableVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (previouslyUsedVoucherId && v.id === previouslyUsedVoucherId) return true;
      return getEffectiveRemaining(v) > 0 && !v.is_used;
    });
  }, [vouchers, previouslyUsedVoucherId, previouslyUsedAmount]);

  const matchingVouchers = useMemo(() => {
    if (!clientSearchQuery) return [];
    return availableVouchers.filter(v => {
      const nameMatch =
        v.recipient_name?.toLowerCase().includes(clientSearchQuery) ||
        v.buyer_name?.toLowerCase().includes(clientSearchQuery);
      const idMatch =
        Boolean(selectedClientId) &&
        (v.recipient_id === selectedClientId || v.buyer_id === selectedClientId);
      return nameMatch || idMatch;
    });
  }, [availableVouchers, clientSearchQuery, selectedClientId]);

  const selectedVoucher = availableVouchers.find(v => v.id === selectedVoucherId);
  const selectedEffRem = selectedVoucher ? getEffectiveRemaining(selectedVoucher) : 0;
  const maxApplicable = selectedVoucher
    ? totalNum > 0
      ? Math.min(selectedEffRem, totalNum)
      : selectedEffRem
    : 0;

  return (
    <div className="pt-2 border-t border-stone-700/60 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={usedGiftVoucher}
          onChange={e => {
            const checked = e.target.checked;
            onChangeUsed(checked);
            if (!checked) {
              onChangeDeduction('');
              return;
            }
            if (!selectedVoucherId && availableVouchers.length > 0) {
              const bestMatch = matchingVouchers[0] || availableVouchers[0];
              if (bestMatch) {
                onChangeVoucherId(bestMatch.id);
                const rem = getEffectiveRemaining(bestMatch);
                const newDed = totalNum > 0 ? Math.min(rem, totalNum) : rem;
                onChangeDeduction(String(newDed));
              }
            } else if (selectedVoucherId) {
              const curV = availableVouchers.find(v => v.id === selectedVoucherId);
              const rem = curV ? getEffectiveRemaining(curV) : 0;
              const newDed = totalNum > 0 ? Math.min(rem, totalNum) : rem;
              onChangeDeduction(String(newDed));
            }
          }}
          className="w-4 h-4 rounded border-stone-600 bg-stone-900 text-amber-500 focus:ring-0 cursor-pointer"
        />
        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5 text-amber-400" />
          Usa Buono Regalo
        </span>
      </label>

      {usedGiftVoucher && (
        <div className="pl-6 space-y-2 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-stone-300 mb-1">
              Seleziona Buono
            </label>
            {availableVouchers.length > 0 ? (
              <select
                value={selectedVoucherId}
                onChange={e => {
                  const vId = e.target.value;
                  onChangeVoucherId(vId);
                  const chosen = availableVouchers.find(v => v.id === vId);
                  if (chosen) {
                    const rem = getEffectiveRemaining(chosen);
                    const newDed = totalNum > 0 ? Math.min(rem, totalNum) : rem;
                    onChangeDeduction(String(newDed));
                  } else {
                    onChangeDeduction('');
                  }
                }}
                className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Seleziona Buono --</option>
                {matchingVouchers.length > 0 && (
                  <optgroup label="Suggeriti per cliente">
                    {matchingVouchers.map(v => (
                      <option key={v.id} value={v.id}>
                        #{v.id.slice(-4)} {v.buyer_name}{' '}
                        {v.recipient_name ? `→ ${v.recipient_name}` : ''} ({getEffectiveRemaining(v)}€)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Tutti i Buoni">
                  {availableVouchers.map(v => (
                    <option key={v.id} value={v.id}>
                      #{v.id.slice(-4)} {v.buyer_name}{' '}
                      {v.recipient_name ? `→ ${v.recipient_name}` : ''} ({getEffectiveRemaining(v)}€)
                    </option>
                  ))}
                </optgroup>
              </select>
            ) : (
              <p className="text-xs text-amber-300/80 italic">
                Nessun buono con credito residuo.
              </p>
            )}
          </div>

          {selectedVoucherId && selectedVoucher && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-300 mb-1 flex items-center justify-between">
                <span>Importo da scalare (€)</span>
                <span className="text-[10px] text-stone-400 font-normal">
                  Max: {maxApplicable}€
                </span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                max={maxApplicable}
                placeholder="0.00"
                value={voucherDeduction}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') {
                    onChangeDeduction('');
                    return;
                  }
                  const num = parseFloat(raw);
                  if (isNaN(num)) {
                    onChangeDeduction('');
                    return;
                  }
                  if (num > maxApplicable) {
                    onChangeDeduction(String(maxApplicable));
                  } else if (num < 0) {
                    onChangeDeduction('0');
                  } else {
                    onChangeDeduction(raw);
                  }
                }}
                className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[10px] text-stone-400 mt-1">
                Residuo disponibile:{' '}
                <strong className="text-amber-400">{selectedEffRem}€</strong> • Dopo:{' '}
                <strong className="text-emerald-400">
                  {Math.max(0, selectedEffRem - (parseFloat(voucherDeduction) || 0))}€
                </strong>
                {!selectedVoucher.recipient_name && (
                  <span className="block text-indigo-300 mt-0.5">
                    Assegna automaticamente a:{' '}
                    <strong>{clientDisplayName || 'cliente'}</strong>
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
