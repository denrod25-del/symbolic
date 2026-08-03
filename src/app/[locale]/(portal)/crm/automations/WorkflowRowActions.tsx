'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteWorkflow, toggleWorkflowActive } from '@/libs/workflowActions';

type WorkflowRowActionsProps = {
  locale: string;
  workflowId: number;
  isActive: boolean;
};

export function WorkflowRowActions(props: WorkflowRowActionsProps) {
  const t = useTranslations('CrmWorkflowRowActions');
  const router = useRouter();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleToggle() {
    await toggleWorkflowActive(props.workflowId, props.locale);
    router.refresh();
  }

  async function handleDelete() {
    await deleteWorkflow(props.workflowId, props.locale);
    router.refresh();
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
        onClick={handleToggle}
        className="text-sm text-white/50 hover:text-white"
      >
        {props.isActive ? t('pause') : t('resume')}
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
