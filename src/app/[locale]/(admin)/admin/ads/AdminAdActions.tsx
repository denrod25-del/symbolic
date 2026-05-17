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

  async function handleClick() {
    setBusy(true);
    await (props.isActive ? suspendAd(props.adId) : unsuspendAd(props.adId));
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className="rounded border border-white/15 px-3 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
    >
      {props.isActive ? props.labels.suspend : props.labels.unsuspend}
    </button>
  );
}
