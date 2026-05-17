'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { approveAd, rejectAd } from '@/libs/adminActions';

export function QueueRowActions(props: {
  adId: number;
  labels: {
    approve: string;
    reject: string;
    reasonPlaceholder: string;
    confirm: string;
    cancel: string;
  };
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    await approveAd(props.adId);
    router.refresh();
  }

  async function handleReject() {
    setBusy(true);
    const result = await rejectAd(props.adId, reason);
    if (result && 'error' in result) {
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={reason}
          onChange={(event) =>{  setReason(event.target.value); }}
          placeholder={props.labels.reasonPlaceholder}
          className="rounded border border-white/15 bg-white/5 px-2 py-1 text-sm"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
          >
            {props.labels.confirm}
          </button>
          <button
            type="button"
            onClick={() =>{  setRejecting(false); }}
            className="rounded border border-white/15 px-3 py-1 text-xs hover:bg-white/5"
          >
            {props.labels.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={handleApprove}
        className="rounded bg-green-600 px-3 py-1 text-xs font-semibold hover:bg-green-500 disabled:opacity-50"
      >
        {props.labels.approve}
      </button>
      <button
        type="button"
        onClick={() =>{  setRejecting(true); }}
        className="rounded border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
      >
        {props.labels.reject}
      </button>
    </div>
  );
}
