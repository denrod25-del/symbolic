'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createQuote,
  suggestQuoteLineItems,
  updateQuote,
} from '@/libs/quoteActions';

type LineItemFields = {
  description: string;
  quantity: string;
  unitPricePounds: string;
};

type QuoteFields = {
  title: string;
  contactId: string;
  notes: string;
  lineItems: LineItemFields[];
};

type QuoteFormProps = {
  locale: string;
  contacts: { id: number; name: string }[];
  initial?: {
    id: number;
    title: string;
    contactId: number | null;
    notes: string;
    lineItems: { description: string; quantity: number; unitPrice: number }[];
  };
  onSaved?: () => void;
};

const emptyLineItem: LineItemFields = {
  description: '',
  quantity: '1',
  unitPricePounds: '',
};

function initialFields(props: QuoteFormProps): QuoteFields {
  if (!props.initial) {
    return { title: '', contactId: '', notes: '', lineItems: [emptyLineItem] };
  }

  return {
    title: props.initial.title,
    contactId: props.initial.contactId ? String(props.initial.contactId) : '',
    notes: props.initial.notes,
    lineItems: props.initial.lineItems.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPricePounds: (item.unitPrice / 100).toFixed(2),
    })),
  };
}

function lineSubtotal(item: LineItemFields): number {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPricePounds) || 0;
  return quantity * unitPrice;
}

export function QuoteForm(props: QuoteFormProps) {
  const t = useTranslations('CrmQuoteForm');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [data, setData] = useState<QuoteFields>(() => initialFields(props));

  async function handleEstimate() {
    if (aiPrompt.trim() === '') {
      return;
    }
    setError(null);
    setAiPending(true);
    try {
      const result = await suggestQuoteLineItems(aiPrompt);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setData((prev) => ({
        ...prev,
        lineItems: result.lineItems.map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          unitPricePounds: item.unitPricePounds.toFixed(2),
        })),
      }));
    } finally {
      setAiPending(false);
    }
  }

  function setField(field: 'title' | 'contactId' | 'notes', value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function setLineItem(
    index: number,
    field: keyof LineItemFields,
    value: string
  ) {
    setData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addLineItem() {
    setData((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { ...emptyLineItem }],
    }));
  }

  function removeLineItem(index: number) {
    setData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  }

  const total = data.lineItems.reduce(
    (sum, item) => sum + lineSubtotal(item),
    0
  );
  const totalLabel = total.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });

  const submitLabel = props.initial ? t('save') : t('add');

  async function handleSubmit() {
    setError(null);
    setPending(true);
    try {
      const payload = {
        title: data.title,
        contactId: data.contactId === '' ? undefined : data.contactId,
        notes: data.notes,
        lineItems: data.lineItems,
      };
      const result = props.initial
        ? await updateQuote(props.initial.id, payload, props.locale)
        : await createQuote(payload, props.locale);

      if (result && 'error' in result) {
        setError(result.error);
        return;
      }

      if (props.initial) {
        props.onSaved?.();
      } else {
        setData({
          title: '',
          contactId: '',
          notes: '',
          lineItems: [{ ...emptyLineItem }],
        });
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">{t('title')}</span>
          <input
            type="text"
            value={data.title}
            onChange={(e) => {
              setField('title', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">
            {t('contact')}
          </span>
          <select
            value={data.contactId}
            onChange={(e) => {
              setField('contactId', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">{t('no_contact')}</option>
            {props.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <span className="block text-sm text-white/60">{t('ai_heading')}</span>
        <textarea
          value={aiPrompt}
          onChange={(e) => {
            setAiPrompt(e.target.value);
          }}
          placeholder={t('ai_placeholder')}
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={async () => {
            await handleEstimate();
          }}
          disabled={aiPending}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
        >
          {aiPending ? t('ai_generating') : t('ai_generate')}
        </button>
      </div>

      <div className="space-y-3">
        <span className="block text-sm text-white/60">{t('line_items')}</span>
        {data.lineItems.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[12rem] flex-1">
              <span className="mb-1 block text-xs text-white/40">
                {t('description')}
              </span>
              <input
                type="text"
                value={item.description}
                onChange={(e) => {
                  setLineItem(index, 'description', e.target.value);
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </label>
            <label className="block w-20">
              <span className="mb-1 block text-xs text-white/40">
                {t('quantity')}
              </span>
              <input
                type="number"
                min="0"
                value={item.quantity}
                onChange={(e) => {
                  setLineItem(index, 'quantity', e.target.value);
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </label>
            <label className="block w-28">
              <span className="mb-1 block text-xs text-white/40">
                {t('unit_price')}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPricePounds}
                onChange={(e) => {
                  setLineItem(index, 'unitPricePounds', e.target.value);
                }}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </label>
            {data.lineItems.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  removeLineItem(index);
                }}
                className="px-2 py-2 text-sm text-red-400 hover:text-red-300"
              >
                {t('remove')}
              </button>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={addLineItem}
          className="text-sm text-indigo-400 hover:underline"
        >
          {t('add_line')}
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-white/60">{t('notes')}</span>
        <textarea
          value={data.notes}
          onChange={(e) => {
            setField('notes', e.target.value);
          }}
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </label>

      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">
          {t('total')}
          {': '}
          <span className="font-semibold text-white">{totalLabel}</span>
        </p>
        <div className="flex gap-3">
          {props.initial && props.onSaved ? (
            <button
              type="button"
              onClick={props.onSaved}
              className="rounded-lg bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              {t('cancel')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? t('saving') : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
