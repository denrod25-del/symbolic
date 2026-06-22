'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { convertQuoteToInvoice } from '@/libs/invoiceActions';
import { deleteQuote, setQuoteStatus } from '@/libs/quoteActions';
import type { CrmQuoteStatus } from '@/utils/Crm';
import { QuoteForm } from './QuoteForm';

type QuoteRowActionsProps = {
  locale: string;
  contacts: { id: number; name: string }[];
  quote: {
    id: number;
    title: string;
    contactId: number | null;
    notes: string;
    status: CrmQuoteStatus;
    lineItems: { description: string; quantity: number; unitPrice: number }[];
  };
};

/** Statuses a quote can transition to (never back to draft). */
type QuoteStatusAction = Exclude<CrmQuoteStatus, 'draft'>;

const nextStatuses: Record<CrmQuoteStatus, QuoteStatusAction[]> = {
  draft: ['sent'],
  sent: ['accepted', 'declined'],
  accepted: ['declined'],
  declined: ['sent'],
};

export function QuoteRowActions(props: QuoteRowActionsProps) {
  const t = useTranslations('CrmQuoteRowActions');
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleDelete() {
    await deleteQuote(props.quote.id, props.locale);
    router.refresh();
  }

  async function handleConvert() {
    await convertQuoteToInvoice(props.quote.id, props.locale);
    router.push(`/${props.locale}/crm/invoices`);
  }

  async function handleStatus(status: QuoteStatusAction) {
    await setQuoteStatus(props.quote.id, status, props.locale);
    router.refresh();
  }

  if (isEditing) {
    return (
      <div className="w-full rounded-lg border border-white/10 bg-white/5 p-4">
        <QuoteForm
          locale={props.locale}
          contacts={props.contacts}
          initial={props.quote}
          onSaved={() => {
            setIsEditing(false);
          }}
        />
      </div>
    );
  }

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
      {props.quote.status === 'accepted' ? (
        <button
          type="button"
          onClick={async () => {
            await handleConvert();
          }}
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          {t('convert')}
        </button>
      ) : null}
      {nextStatuses[props.quote.status].map((status) => (
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
          setIsEditing(true);
        }}
        className="text-sm text-indigo-400 hover:underline"
      >
        {t('edit')}
      </button>
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
