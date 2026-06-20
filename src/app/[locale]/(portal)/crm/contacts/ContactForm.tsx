'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createContact, updateContact } from '@/libs/crmActions';

type ContactFields = {
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
};

type ContactFormProps = {
  locale: string;
  initial?: ContactFields & { id: number };
  onSaved?: () => void;
};

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-white/60">{props.label}</span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
        }}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      />
    </label>
  );
}

export function ContactForm(props: ContactFormProps) {
  const t = useTranslations('CrmContactForm');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<ContactFields>(
    () =>
      props.initial ?? {
        name: '',
        email: '',
        phone: '',
        company: '',
        notes: '',
      }
  );

  function set(field: keyof ContactFields, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  const submitLabel = props.initial ? t('save') : t('add');

  async function handleSubmit() {
    setError(null);
    setPending(true);
    try {
      const result = props.initial
        ? await updateContact(props.initial.id, data, props.locale)
        : await createContact(data, props.locale);

      if (result && 'error' in result) {
        setError(result.error);
        return;
      }

      if (props.initial) {
        props.onSaved?.();
      } else {
        setData({ name: '', email: '', phone: '', company: '', notes: '' });
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
        <Field
          label={t('name')}
          value={data.name}
          onChange={(v) => {
            set('name', v);
          }}
        />
        <Field
          label={t('company')}
          value={data.company}
          onChange={(v) => {
            set('company', v);
          }}
        />
        <Field
          label={t('email')}
          type="email"
          value={data.email}
          onChange={(v) => {
            set('email', v);
          }}
        />
        <Field
          label={t('phone')}
          value={data.phone}
          onChange={(v) => {
            set('phone', v);
          }}
        />
      </div>
      <label className="block">
        <span className="mb-1 block text-sm text-white/60">{t('notes')}</span>
        <textarea
          value={data.notes}
          onChange={(e) => {
            set('notes', e.target.value);
          }}
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </label>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? t('saving') : submitLabel}
        </button>
        {props.initial && props.onSaved ? (
          <button
            type="button"
            onClick={props.onSaved}
            className="rounded-lg bg-white/5 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t('cancel')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
