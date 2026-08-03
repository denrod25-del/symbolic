'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createInvoicePaymentLink,
  deleteInvoice,
  setInvoiceStatus,
} from '@/libs/invoiceActions';
import type { CrmInvoiceStatus } from '@/utils/Crm';

type InvoiceRowActionsProps = {
  locale: string;
  invoice: {
    id: number;
    status: CrmInvoiceStatus;
    hasPaymentLink: boolean;
  };
};

/** Statuses an invoice can transition to (never back to draft). */
type InvoiceStatusAction = Exclude<CrmInvoiceStatus, 'draft'>;

const nextStatuses: Record<CrmInvoiceStatus, InvoiceStatusAction[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'void'],
  paid: [],
  void: [],
};

export function InvoiceRowActions(props: InvoiceRowActionsProps) {
  const t = useTranslations('CrmInvoiceRowActions');
  const router = useRouter();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleDelete() {
    await deleteInvoice(props.invoice.id, props.locale);
    router.refresh();
  }

  async function handleStatus(status: InvoiceStatusAction) {
    await setInvoiceStatus(props.invoice.id, status, props.locale);
    router.refresh();
  }

  async function handlePaymentLink() {
    await createInvoicePaymentLink(props.invoice.id, props.locale);
    router.refresh();
  }

  const canCreateLink =
    !props.invoice.hasPaymentLink &&
    (props.invoice.status === 'draft' || props.invoice.status === 'sent');

  if (isConfirmingDelete) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm text-white/70">{t('delete_confirm')}</span>
        <button
          type="button"
          onClick={handleDelete}
          className="text-sm font-medium text-red-400 hover:text-red-300"
        >
          {t('delete_yes')}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConfirmingDelete(false);
          }}
          className="text-sm text-white/50 hover:text-white"
        >
          {t('delete_cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
      {canCreateLink ? (
        <button
          type="button"
          onClick={async () => {
            await handlePaymentLink();
          }}
          className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          {t('create_link')}
        </button>
      ) : null}
      {nextStatuses[props.invoice.status].map((status) => (
        <button
          key={status}
          type="button"
          onClick={async () => {
            await handleStatus(status);
          }}
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          {t(`mark_${status}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          setIsConfirmingDelete(true);
        }}
        className="text-sm text-red-400 hover:text-red-300"
      >
        {t('delete')}
      </button>
    </div>
  );
}
