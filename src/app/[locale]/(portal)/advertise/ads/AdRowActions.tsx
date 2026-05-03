'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteAd, toggleAdActive } from '@/libs/adActions';

type AdRowActionsProps = {
  adId: number;
  isActive: boolean;
  locale: string;
};

export function AdRowActions(props: AdRowActionsProps) {
  const router = useRouter();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleToggle() {
    await toggleAdActive(props.adId, props.locale);
    router.refresh();
  }

  async function handleDelete() {
    await deleteAd(props.adId, props.locale);
    router.refresh();
  }

  if (isConfirmingDelete) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/70">Delete this ad?</span>
        <button
          type="button"
          onClick={async () => {
            await handleDelete();
          }}
          className="text-sm font-medium text-red-400 hover:text-red-300"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirmingDelete(false);
          }}
          className="text-sm text-white/50 hover:text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/${props.locale}/advertise/ads/${props.adId}/edit`}
        className="text-sm text-indigo-400 hover:underline"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-white/50 hover:text-white"
      >
        {props.isActive ? 'Pause' : 'Resume'}
      </button>
      <button
        type="button"
        onClick={() => {
          setIsConfirmingDelete(true);
        }}
        className="text-sm text-red-400 hover:text-red-300"
      >
        Delete
      </button>
    </div>
  );
}
