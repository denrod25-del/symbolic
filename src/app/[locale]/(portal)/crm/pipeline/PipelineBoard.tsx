'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createOpportunity,
  deleteOpportunity,
  moveOpportunity,
} from '@/libs/crmActions';
import { CRM_STAGES } from '@/utils/Crm';

type Opportunity = {
  id: number;
  title: string;
  stage: string;
  value: number;
  contactId: number | null;
};

type Contact = { id: number; name: string };

type PipelineBoardProps = {
  locale: string;
  opportunities: Opportunity[];
  contacts: Contact[];
};

function formatValue(pence: number) {
  return (pence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}

export function PipelineBoard(props: PipelineBoardProps) {
  const t = useTranslations('CrmPipelinePage');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState('');
  const [valuePounds, setValuePounds] = useState('0');
  const [contactId, setContactId] = useState('');

  const contactName = (id: number | null) =>
    props.contacts.find((c) => c.id === id)?.name ?? null;

  async function handleAdd() {
    setError(null);
    setPending(true);
    try {
      const result = await createOpportunity(
        {
          title,
          valuePounds,
          contactId: contactId === '' ? undefined : Number(contactId),
        },
        props.locale
      );
      if (result && 'error' in result) {
        setError(result.error);
        return;
      }
      setTitle('');
      setValuePounds('0');
      setContactId('');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleMove(id: number, stage: string) {
    await moveOpportunity(id, stage, props.locale);
    router.refresh();
  }

  async function handleDelete(id: number) {
    await deleteOpportunity(id, props.locale);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('add_heading')}
        </h2>
        {error && (
          <p className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder={t('field_title')}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
          <select
            value={contactId}
            onChange={(e) => {
              setContactId(e.target.value);
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">{t('no_contact')}</option>
            {props.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-white/50">£</span>
            <input
              type="number"
              min="0"
              step="1"
              value={valuePounds}
              onChange={(e) => {
                setValuePounds(e.target.value);
              }}
              className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? t('adding') : t('add')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CRM_STAGES.map((stage) => {
          const cards = props.opportunities.filter((o) => o.stage === stage);
          const total = cards.reduce((sum, c) => sum + c.value, 0);
          return (
            <div
              key={stage}
              className="rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">
                  {t(`stage_${stage}`)}
                </span>
                <span className="text-xs text-white/40">
                  {formatValue(total)}
                </span>
              </div>
              <div className="space-y-2">
                {cards.length === 0 ? (
                  <p className="text-xs text-white/30">{t('stage_empty')}</p>
                ) : (
                  cards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border border-white/10 bg-[#0d0d14] p-3"
                    >
                      <p className="text-sm font-medium">{card.title}</p>
                      <p className="text-xs text-white/40">
                        {formatValue(card.value)}
                        {contactName(card.contactId)
                          ? ` · ${contactName(card.contactId)}`
                          : ''}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={card.stage}
                          onChange={async (e) => {
                            await handleMove(card.id, e.target.value);
                          }}
                          className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        >
                          {CRM_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {t(`stage_${s}`)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleDelete(card.id);
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
