'use client';

import { useState } from 'react';
import { createTopUpSession } from '@/libs/billingActions';

const PRESETS_CENTS = [2500, 5000, 10_000];
const MIN_TOPUP_CENTS = 1000;

export function TopUpButtons(props: {
  labels: { custom: string; submit: string };
}) {
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start(amountCents: number) {
    setBusy(true);
    setError('');
    const result = await createTopUpSession(amountCents);
    if ('error' in result) {
      setError(result.error);
      setBusy(false);
      return;
    }
    window.location.href = result.url;
  }

  const customCents = Math.round(Number(custom) * 100);
  const customValid =
    Number.isFinite(customCents) && customCents >= MIN_TOPUP_CENTS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS_CENTS.map((cents) => (
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            disabled={busy}
            key={cents}
            onClick={async () => {
              await start(cents);
            }}
            type="button"
          >
            ${cents / 100}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="w-40 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm"
          inputMode="decimal"
          onChange={(event) => {
            setCustom(event.target.value);
          }}
          placeholder={props.labels.custom}
          value={custom}
        />
        <button
          className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          disabled={busy || !customValid}
          onClick={async () => {
            await start(customCents);
          }}
          type="button"
        >
          {props.labels.submit}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
