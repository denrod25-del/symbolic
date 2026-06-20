'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createAppointment, updateAppointment } from '@/libs/bookingActions';

export type AppointmentContact = { id: number; name: string };

type AppointmentInitial = {
  id: number;
  title: string;
  contactId: number | null;
  startAt: string;
  endAt: string;
  notes: string;
};

type AppointmentFormProps = {
  locale: string;
  contacts: AppointmentContact[];
  initial?: AppointmentInitial;
  onSaved?: () => void;
};

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialFields(initial?: AppointmentInitial) {
  if (initial) {
    const start = new Date(initial.startAt);
    const end = new Date(initial.endAt);
    return {
      title: initial.title,
      contactId: initial.contactId ? String(initial.contactId) : '',
      date: toDateValue(start),
      time: toTimeValue(start),
      durationMinutes: String(
        Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000))
      ),
      notes: initial.notes,
    };
  }
  const now = new Date();
  return {
    title: '',
    contactId: '',
    date: toDateValue(now),
    time: '09:00',
    durationMinutes: '30',
    notes: '',
  };
}

export function AppointmentForm(props: AppointmentFormProps) {
  const t = useTranslations('CrmAppointmentForm');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [data, setData] = useState(() => initialFields(props.initial));

  function set(field: keyof typeof data, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  const submitLabel = props.initial ? t('save') : t('book');

  async function handleSubmit() {
    setError(null);

    const startAt = new Date(`${data.date}T${data.time}`);
    if (Number.isNaN(startAt.getTime())) {
      setError(t('invalid_datetime'));
      return;
    }

    setPending(true);
    try {
      const payload = {
        title: data.title,
        contactId: data.contactId === '' ? undefined : Number(data.contactId),
        startAt: startAt.toISOString(),
        durationMinutes: data.durationMinutes,
        notes: data.notes,
      };

      const result = props.initial
        ? await updateAppointment(props.initial.id, payload, props.locale)
        : await createAppointment(payload, props.locale);

      if (result && 'error' in result) {
        setError(result.error);
        return;
      }

      if (props.initial) {
        props.onSaved?.();
      } else {
        setData(initialFields());
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
      <label className="block">
        <span className="mb-1 block text-sm text-white/60">{t('title')}</span>
        <input
          type="text"
          value={data.title}
          onChange={(e) => {
            set('title', e.target.value);
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">{t('date')}</span>
          <input
            type="date"
            value={data.date}
            onChange={(e) => {
              set('date', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">{t('time')}</span>
          <input
            type="time"
            value={data.time}
            onChange={(e) => {
              set('time', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">
            {t('duration')}
          </span>
          <select
            value={data.durationMinutes}
            onChange={(e) => {
              set('durationMinutes', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="15">{t('duration_15')}</option>
            <option value="30">{t('duration_30')}</option>
            <option value="45">{t('duration_45')}</option>
            <option value="60">{t('duration_60')}</option>
            <option value="90">{t('duration_90')}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">
            {t('contact')}
          </span>
          <select
            value={data.contactId}
            onChange={(e) => {
              set('contactId', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">{t('no_contact')}</option>
            {props.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
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
