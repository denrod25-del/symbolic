'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createWorkflow } from '@/libs/workflowActions';
import {
  CRM_MESSAGE_CHANNELS,
  CRM_STAGES,
  CRM_WORKFLOW_ACTIONS,
  CRM_WORKFLOW_TRIGGERS,
  isCrmMessageChannel,
  isCrmWorkflowAction,
  isCrmWorkflowTrigger,
} from '@/utils/Crm';
import type {
  CrmMessageChannel,
  CrmWorkflowAction,
  CrmWorkflowTrigger,
} from '@/utils/Crm';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:outline-none';

function asTrigger(value: string): CrmWorkflowTrigger {
  return isCrmWorkflowTrigger(value) ? value : 'contact_created';
}

function asAction(value: string): CrmWorkflowAction {
  return isCrmWorkflowAction(value) ? value : 'send_message';
}

function asChannel(value: string): CrmMessageChannel {
  return isCrmMessageChannel(value) ? value : 'sms';
}

export function WorkflowForm(props: { locale: string }) {
  const t = useTranslations('CrmWorkflowForm');
  const tStage = useTranslations('CrmPipelinePage');
  const router = useRouter();
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] =
    useState<CrmWorkflowTrigger>('contact_created');
  const [triggerStage, setTriggerStage] = useState('');
  const [actionType, setActionType] =
    useState<CrmWorkflowAction>('send_message');
  const [messageChannel, setMessageChannel] =
    useState<CrmMessageChannel>('sms');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [opportunityTitle, setOpportunityTitle] = useState('');
  const [opportunityValuePounds, setOpportunityValuePounds] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    setError(null);
    setPending(true);
    try {
      const result = await createWorkflow(
        {
          name,
          triggerType,
          triggerStage,
          actionType,
          messageChannel,
          messageSubject,
          messageBody,
          opportunityTitle,
          opportunityValuePounds,
        },
        props.locale
      );
      if (result && 'error' in result) {
        setError(result.error);
        return;
      }
      setName('');
      setMessageSubject('');
      setMessageBody('');
      setOpportunityTitle('');
      setOpportunityValuePounds('0');
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
        <span className="mb-1 block text-sm text-white/60">{t('name')}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder={t('name_placeholder')}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">
            {t('trigger')}
          </span>
          <select
            value={triggerType}
            onChange={(e) => {
              setTriggerType(asTrigger(e.target.value));
            }}
            className={inputClass}
          >
            {CRM_WORKFLOW_TRIGGERS.map((trigger) => (
              <option key={trigger} value={trigger}>
                {t(`trigger_${trigger}`)}
              </option>
            ))}
          </select>
        </label>

        {triggerType === 'opportunity_stage_changed' ? (
          <label className="block">
            <span className="mb-1 block text-sm text-white/60">
              {t('trigger_stage')}
            </span>
            <select
              value={triggerStage}
              onChange={(e) => {
                setTriggerStage(e.target.value);
              }}
              className={inputClass}
            >
              <option value="">{t('any_stage')}</option>
              {CRM_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {tStage(`stage_${stage}`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-white/60">{t('action')}</span>
        <select
          value={actionType}
          onChange={(e) => {
            setActionType(asAction(e.target.value));
          }}
          className={inputClass}
        >
          {CRM_WORKFLOW_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {t(`action_${action}`)}
            </option>
          ))}
        </select>
      </label>

      {actionType === 'send_message' ? (
        <div className="space-y-4 rounded-lg border border-white/10 p-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/60">
              {t('channel')}
            </span>
            <select
              value={messageChannel}
              onChange={(e) => {
                setMessageChannel(asChannel(e.target.value));
              }}
              className={inputClass}
            >
              {CRM_MESSAGE_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {t(`channel_${channel}`)}
                </option>
              ))}
            </select>
          </label>
          {messageChannel === 'email' ? (
            <input
              type="text"
              value={messageSubject}
              onChange={(e) => {
                setMessageSubject(e.target.value);
              }}
              placeholder={t('subject_placeholder')}
              className={inputClass}
            />
          ) : null}
          <textarea
            value={messageBody}
            onChange={(e) => {
              setMessageBody(e.target.value);
            }}
            rows={3}
            placeholder={t('body_placeholder')}
            className={inputClass}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-white/10 p-4 sm:grid-cols-2">
          <input
            type="text"
            value={opportunityTitle}
            onChange={(e) => {
              setOpportunityTitle(e.target.value);
            }}
            placeholder={t('opportunity_title_placeholder')}
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <span className="text-white/50">£</span>
            <input
              type="number"
              min="0"
              step="1"
              value={opportunityValuePounds}
              onChange={(e) => {
                setOpportunityValuePounds(e.target.value);
              }}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={pending || name.trim() === ''}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? t('creating') : t('create')}
      </button>
    </div>
  );
}
