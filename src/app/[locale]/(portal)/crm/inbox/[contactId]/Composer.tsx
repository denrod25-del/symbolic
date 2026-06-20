'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { sendMessage } from '@/libs/messagingActions';
import type { CrmMessageChannel } from '@/utils/Crm';

type ComposerProps = {
  locale: string;
  contactId: number;
  hasEmail: boolean;
  hasPhone: boolean;
};

export function Composer(props: ComposerProps) {
  const t = useTranslations('CrmComposer');
  const router = useRouter();
  const defaultChannel: CrmMessageChannel = props.hasPhone ? 'sms' : 'email';
  const [channel, setChannel] = useState<CrmMessageChannel>(defaultChannel);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSend = (channel === 'email' && props.hasEmail) || channel === 'sms';

  async function handleSend() {
    setError(null);
    setPending(true);
    try {
      const result = await sendMessage(
        { contactId: props.contactId, channel, subject, body },
        props.locale
      );
      if (result && 'error' in result) {
        setError(result.error);
        return;
      }
      setSubject('');
      setBody('');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      {error && (
        <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setChannel('sms');
          }}
          disabled={!props.hasPhone}
          className={`rounded px-3 py-1 text-sm font-medium disabled:opacity-30 ${
            channel === 'sms'
              ? 'bg-indigo-600 text-white'
              : 'bg-white/5 text-white/50 hover:text-white'
          }`}
        >
          {t('channel_sms')}
        </button>
        <button
          type="button"
          onClick={() => {
            setChannel('email');
          }}
          disabled={!props.hasEmail}
          className={`rounded px-3 py-1 text-sm font-medium disabled:opacity-30 ${
            channel === 'email'
              ? 'bg-indigo-600 text-white'
              : 'bg-white/5 text-white/50 hover:text-white'
          }`}
        >
          {t('channel_email')}
        </button>
      </div>

      {channel === 'email' ? (
        <input
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
          }}
          placeholder={t('subject_placeholder')}
          className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      ) : null}

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
        }}
        rows={3}
        placeholder={t('body_placeholder')}
        className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-white/30">{t('stub_hint')}</span>
        <button
          type="button"
          onClick={handleSend}
          disabled={pending || !canSend || body.trim() === ''}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? t('sending') : t('send')}
        </button>
      </div>
    </div>
  );
}
