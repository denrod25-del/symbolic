'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { suspendAd, unsuspendAd } from '@/libs/adminActions';

export function AdminAdActions(props: {
  adId: number;
  isActive: boolean;
  labels: { suspend: string; unsuspend: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setBusy(true);
    setError('');
    const result = props.isActive
      ? await suspendAd(props.adId)
      : await unsuspendAd(props.adId);
    if (result && 'error' in result) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className="rounded border border-white/15 px-3 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
      >
        {props.isActive ? props.labels.suspend : props.labels.unsuspend}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
