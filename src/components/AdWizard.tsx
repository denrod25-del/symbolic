'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createAd, updateAd } from '@/libs/adActions';

type WizardData = {
  title: string;
  url: string;
  displayUrl: string;
  description: string;
  ctaText: string;
  keywords: string;
  bidPounds: string;
};

type AdWizardProps = {
  locale: string;
  initialData?: {
    id: number;
    title: string;
    url: string;
    displayUrl: string;
    description: string;
    ctaText: string;
    keywords: string[];
    bidAmount: number;
  };
};

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-white/60">{props.label}</span>
      <input
        type="text"
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
        }}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      />
    </label>
  );
}

export function AdWizard(props: AdWizardProps) {
  const t = useTranslations('AdWizard');
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [data, setData] = useState<WizardData>(() =>
    props.initialData
      ? {
          title: props.initialData.title,
          url: props.initialData.url,
          displayUrl: props.initialData.displayUrl,
          description: props.initialData.description,
          ctaText: props.initialData.ctaText,
          keywords: props.initialData.keywords.join(', '),
          bidPounds: (props.initialData.bidAmount / 100).toFixed(2),
        }
      : {
          title: '',
          url: '',
          displayUrl: '',
          description: '',
          ctaText: '',
          keywords: '',
          bidPounds: '0.50',
        }
  );

  function set(field: keyof WizardData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePublish() {
    setError(null);
    setPending(true);
    try {
      const payload = {
        title: data.title,
        url: data.url,
        displayUrl: data.displayUrl,
        description: data.description,
        ctaText: data.ctaText,
        keywords: data.keywords,
        bidPounds: data.bidPounds,
      };

      const result = props.initialData
        ? await updateAd(props.initialData.id, payload)
        : await createAd(payload);

      if (result && 'error' in result) {
        setError(result.error);
      } else {
        router.push(`/${props.locale}/advertise/ads`);
      }
    } finally {
      setPending(false);
    }
  }

  const steps = [
    { num: 1, label: t('step_content') },
    { num: 2, label: t('step_keywords') },
    { num: 3, label: t('step_bid') },
  ];

  const publishLabel = props.initialData
    ? t('button_save_changes')
    : t('button_publish');

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">
        {props.initialData ? t('edit_title') : t('create_title')}
      </h1>

      {/* Step indicator */}
      <div className="mb-8 flex gap-2">
        {steps.map((s) => (
          <span
            key={s.num}
            className={`rounded px-3 py-1 text-sm font-medium ${
              step === s.num
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-white/40'
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Step 1: Content */}
      {step === 1 && (
        <div className="space-y-4">
          <Field
            label={t('field_headline')}
            value={data.title}
            onChange={(v) => {
              set('title', v);
            }}
            placeholder='e.g. "Best running shoes 2026"'
            maxLength={80}
          />
          <Field
            label={t('field_destination_url')}
            value={data.url}
            onChange={(v) => {
              set('url', v);
            }}
            placeholder="https://..."
          />
          <Field
            label={t('field_display_url')}
            value={data.displayUrl}
            onChange={(v) => {
              set('displayUrl', v);
            }}
            placeholder='e.g. "myshop.com/shoes"'
            maxLength={60}
          />
          <Field
            label={t('field_description')}
            value={data.description}
            onChange={(v) => {
              set('description', v);
            }}
            placeholder="1–2 sentences about your ad"
            maxLength={200}
          />
          <Field
            label={t('field_cta_text')}
            value={data.ctaText}
            onChange={(v) => {
              set('ctaText', v);
            }}
            placeholder='e.g. "Shop Now"'
            maxLength={30}
          />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setStep(2);
              }}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold hover:bg-indigo-500"
            >
              {t('button_next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Keywords */}
      {step === 2 && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/60">
              {t('keywords_label')}
            </span>
            <p className="mb-2 text-xs text-white/40">{t('keywords_hint')}</p>
            <textarea
              value={data.keywords}
              onChange={(e) => {
                set('keywords', e.target.value);
              }}
              rows={3}
              placeholder="running shoes, trainers, nike, sports footwear"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </label>
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setStep(1);
              }}
              className="rounded-lg bg-white/5 px-6 py-2 text-sm font-semibold hover:bg-white/10"
            >
              {t('button_back')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(3);
              }}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold hover:bg-indigo-500"
            >
              {t('button_next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Bid */}
      {step === 3 && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/60">
              {t('bid_label')}
            </span>
            <p className="mb-2 text-xs text-white/40">{t('bid_hint')}</p>
            <div className="flex items-center gap-2">
              <span className="text-white/50">$</span>
              <input
                type="number"
                step="0.01"
                min="0.10"
                value={data.bidPounds}
                onChange={(e) => {
                  set('bidPounds', e.target.value);
                }}
                className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <span className="text-sm text-white/40">
                {t('bid_per_click')}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/30">{t('bid_minimum')}</p>
          </label>
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setStep(2);
              }}
              className="rounded-lg bg-white/5 px-6 py-2 text-sm font-semibold hover:bg-white/10"
            >
              {t('button_back')}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={pending}
              className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
            >
              {pending ? t('button_saving') : publishLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
