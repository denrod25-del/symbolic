import { currentUser } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmWorkflowRuns, crmWorkflows } from '@/models/Schema';
import {
  isCrmWorkflowAction,
  isCrmWorkflowRunStatus,
  isCrmWorkflowTrigger,
} from '@/utils/Crm';
import { WorkflowForm } from './WorkflowForm';
import { WorkflowRowActions } from './WorkflowRowActions';

const runStatusColor: Record<string, string> = {
  success: 'text-green-300',
  failed: 'text-red-400',
  skipped: 'text-white/40',
};

export default async function CrmAutomationsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmAutomationsPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const workflows = await db
    .select()
    .from(crmWorkflows)
    .where(eq(crmWorkflows.ownerClerkUserId, user.id))
    .orderBy(desc(crmWorkflows.createdAt));

  const runs = await db
    .select({
      id: crmWorkflowRuns.id,
      status: crmWorkflowRuns.status,
      detail: crmWorkflowRuns.detail,
      createdAt: crmWorkflowRuns.createdAt,
      workflowName: crmWorkflows.name,
    })
    .from(crmWorkflowRuns)
    .innerJoin(crmWorkflows, eq(crmWorkflowRuns.workflowId, crmWorkflows.id))
    .where(eq(crmWorkflowRuns.ownerClerkUserId, user.id))
    .orderBy(desc(crmWorkflowRuns.createdAt))
    .limit(20);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-sm text-white/50">{t('subtitle')}</p>

      <div className="mb-10 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('create_heading')}
        </h2>
        <WorkflowForm locale={locale} />
      </div>

      <h2 className="mb-4 text-sm font-semibold text-white/70">
        {t('active_heading')}
      </h2>
      {workflows.length === 0 ? (
        <p className="mb-10 text-sm text-white/40">{t('empty')}</p>
      ) : (
        <ul className="mb-10 divide-y divide-white/10 rounded-lg border border-white/10">
          {workflows.map((workflow) => (
            <li
              key={workflow.id}
              className="flex items-start justify-between gap-4 p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{workflow.name}</p>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      workflow.active
                        ? 'bg-green-500/15 text-green-300'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {workflow.active ? t('badge_active') : t('badge_paused')}
                  </span>
                </div>
                <p className="text-sm text-white/50">
                  {isCrmWorkflowTrigger(workflow.triggerType)
                    ? t(`trigger_${workflow.triggerType}`)
                    : workflow.triggerType}
                  {' → '}
                  {isCrmWorkflowAction(workflow.actionType)
                    ? t(`action_${workflow.actionType}`)
                    : workflow.actionType}
                </p>
              </div>
              <WorkflowRowActions
                isActive={workflow.active}
                locale={locale}
                workflowId={workflow.id}
              />
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-4 text-sm font-semibold text-white/70">
        {t('runs_heading')}
      </h2>
      {runs.length === 0 ? (
        <p className="text-sm text-white/40">{t('runs_empty')}</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {runs.map((run) => (
            <li
              key={run.id}
              className="flex items-center justify-between gap-4 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="font-medium">{run.workflowName}</span>
                  {run.detail ? (
                    <span className="text-white/40"> — {run.detail}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`text-xs font-medium ${
                    runStatusColor[run.status] ?? 'text-white/40'
                  }`}
                >
                  {isCrmWorkflowRunStatus(run.status)
                    ? t(`run_status_${run.status}`)
                    : run.status}
                </span>
                <span className="text-xs text-white/30">
                  {run.createdAt.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
