'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setInvoiceCost } from '@/libs/invoiceActions';

type InvoiceCostFieldProps = {
  locale: string;
  invoiceId: number;
  cost: string;
};

export function InvoiceCostField(props: InvoiceCostFieldProps) {
  const t = useTranslations('CrmInvoicesPage');
  const router = useRouter();
  const [cost, setCost] = useState(props.cost);
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    try {
      await setInvoiceCost(props.invoiceId, cost, props.locale);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-white/40">{t('cost')}</span>
      <span className="text-xs text-white/40">£</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={cost}
        onChange={(e) => {
          setCost(e.target.value);
        }}
        className="w-24 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          await handleSave();
        }}
        disabled={pending}
        className="text-xs text-indigo-400 hover:underline disabled:opacity-50"
      >
        {t('cost_save')}
      </button>
    </div>
  );
}
