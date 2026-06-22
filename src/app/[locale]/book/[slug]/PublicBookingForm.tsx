'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { requestBooking } from '@/libs/bookingSettingsActions';

type PublicBookingFormProps = {
  slug: string;
};

type BookingFields = {
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  notes: string;
};

const emptyFields: BookingFields = {
  name: '',
  email: '',
  phone: '',
  date: '',
  time: '',
  notes: '',
};

export function PublicBookingForm(props: PublicBookingFormProps) {
  const t = useTranslations('PublicBookingForm');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [data, setData] = useState<BookingFields>(emptyFields);

  function set(field: keyof BookingFields, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError(null);
    const startAt = new Date(`${data.date}T${data.time}`);
    if (Number.isNaN(startAt.getTime())) {
      setError(t('invalid_datetime'));
      return;
    }

    setPending(true);
    try {
      const result = await requestBooking(props.slug, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        startAt: startAt.toISOString(),
        notes: data.notes,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
        {t('confirmation')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm text-white/60">{t('name')}</span>
        <input
          type="text"
          value={data.name}
          onChange={(e) => {
            set('name', e.target.value);
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">{t('email')}</span>
          <input
            type="email"
            value={data.email}
            onChange={(e) => {
              set('email', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">{t('phone')}</span>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => {
              set('phone', e.target.value);
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </label>
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

      <button
        type="button"
        onClick={async () => {
          await handleSubmit();
        }}
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? t('booking') : t('book')}
      </button>
    </div>
  );
}
