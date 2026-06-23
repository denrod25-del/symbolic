'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateBookingSettings } from '@/libs/bookingSettingsActions';

type BookingSettingsFields = {
  businessName: string;
  enabled: boolean;
  defaultDurationMinutes: number;
};

type BookingSettingsFormProps = {
  locale: string;
  initial: BookingSettingsFields;
};

const DURATIONS = [15, 30, 45, 60, 90, 120];

export function BookingSettingsForm(props: BookingSettingsFormProps) {
  const t = useTranslations('CrmBookingSettingsForm');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<BookingSettingsFields>(props.initial);

  async function handleSubmit() {
    setError(null);
    setPending(true);
    try {
      const result = await updateBookingSettings(data, props.locale);
      if ('error' in result) {
        setError(result.error);
        return;
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
        <span className="mb-1 block text-sm text-white/60">
          {t('business_name')}
        </span>
        <input
          type="text"
          value={data.businessName}
          onChange={(e) => {
            setData((prev) => ({ ...prev, businessName: e.target.value }));
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-white/60">
          {t('default_duration')}
        </span>
        <select
          value={data.defaultDurationMinutes}
          onChange={(e) => {
            setData((prev) => ({
              ...prev,
              defaultDurationMinutes: Number(e.target.value),
            }));
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        >
          {DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {t('minutes', { count: minutes })}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={data.enabled}
          onChange={(e) => {
            setData((prev) => ({ ...prev, enabled: e.target.checked }));
          }}
          className="size-4 rounded border-white/10 bg-white/5"
        />
        <span className="text-sm text-white/70">{t('enabled')}</span>
      </label>

      <button
        type="button"
        onClick={async () => {
          await handleSubmit();
        }}
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </div>
  );
}
