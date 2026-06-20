'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteContact } from '@/libs/crmActions';
import { ContactForm } from './ContactForm';

type ContactRowActionsProps = {
  locale: string;
  contact: {
    id: number;
    name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
  };
};

export function ContactRowActions(props: ContactRowActionsProps) {
  const t = useTranslations('CrmContactRowActions');
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleDelete() {
    await deleteContact(props.contact.id, props.locale);
    router.refresh();
  }

  if (isEditing) {
    return (
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white/5 p-4">
        <ContactForm
          locale={props.locale}
          initial={props.contact}
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
    <div className="flex shrink-0 items-center gap-3">
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
