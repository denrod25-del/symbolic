'use server';

import { currentUser } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { crmWorkflows } from '@/models/Schema';
import {
  CRM_MESSAGE_CHANNELS,
  CRM_STAGES,
  CRM_WORKFLOW_ACTIONS,
  CRM_WORKFLOW_TRIGGERS,
} from '@/utils/Crm';
import { db } from './DB';

const workflowFormSchema = z.object({
  name: z.string().min(1).max(120),
  triggerType: z.enum(CRM_WORKFLOW_TRIGGERS),
  triggerStage: z.string().optional(),
  actionType: z.enum(CRM_WORKFLOW_ACTIONS),
  messageChannel: z.enum(CRM_MESSAGE_CHANNELS).optional(),
  messageSubject: z.string().max(200).optional(),
  messageBody: z.string().max(4000).optional(),
  opportunityTitle: z.string().max(120).optional(),
  opportunityValuePounds: z.coerce.number().min(0).optional(),
});

type WorkflowFormData = z.input<typeof workflowFormSchema>;

type Parsed = z.output<typeof workflowFormSchema>;

function revalidateWorkflows(locale: string) {
  try {
    revalidatePath(`/${locale}/crm/automations`);
  } catch {
    // no-op outside Next.js runtime
  }
}

function buildTriggerConfig(data: Parsed): Record<string, unknown> {
  if (
    data.triggerType === 'opportunity_stage_changed' &&
    data.triggerStage &&
    (CRM_STAGES as readonly string[]).includes(data.triggerStage)
  ) {
    return { stage: data.triggerStage };
  }
  return {};
}

function buildActionConfig(
  data: Parsed
): { config: Record<string, unknown> } | { error: string } {
  if (data.actionType === 'send_message') {
    if (!data.messageChannel) {
      return { error: 'Choose a message channel' };
    }
    const body = data.messageBody?.trim() ?? '';
    if (body === '') {
      return { error: 'Message body is required' };
    }
    const subject = data.messageSubject?.trim() ?? '';
    return {
      config: {
        channel: data.messageChannel,
        body,
        ...(data.messageChannel === 'email' && subject ? { subject } : {}),
      },
    };
  }

  const title = data.opportunityTitle?.trim() ?? '';
  if (title === '') {
    return { error: 'Opportunity title is required' };
  }
  return {
    config: {
      title,
      value: Math.round((data.opportunityValuePounds ?? 0) * 100),
    },
  };
}

/**
 * Creates an automation workflow for the signed-in user.
 * @param data - Validated workflow form fields.
 * @param locale - Current locale used to revalidate the automations path.
 * @returns Success indicator or an error message.
 */
export async function createWorkflow(
  data: WorkflowFormData,
  locale: string
): Promise<{ success: true } | { error: string }> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const parsed = workflowFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const action = buildActionConfig(parsed.data);
  if ('error' in action) {
    return { error: action.error };
  }

  await db.insert(crmWorkflows).values({
    ownerClerkUserId: user.id,
    name: parsed.data.name,
    triggerType: parsed.data.triggerType,
    triggerConfig: buildTriggerConfig(parsed.data),
    actionType: parsed.data.actionType,
    actionConfig: action.config,
  });

  revalidateWorkflows(locale);
  return { success: true };
}

/**
 * Flips a workflow's active flag. Verifies ownership first.
 * @param id - The workflow's database ID.
 * @param locale - Current locale used to revalidate the automations path.
 * @returns An error message object on failure, or undefined on success.
 */
export async function toggleWorkflowActive(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const [workflow] = await db
    .select({ active: crmWorkflows.active })
    .from(crmWorkflows)
    .where(
      and(eq(crmWorkflows.id, id), eq(crmWorkflows.ownerClerkUserId, user.id))
    )
    .limit(1);

  if (!workflow) {
    return { error: 'Workflow not found' };
  }

  await db
    .update(crmWorkflows)
    .set({ active: !workflow.active })
    .where(
      and(eq(crmWorkflows.id, id), eq(crmWorkflows.ownerClerkUserId, user.id))
    );

  revalidateWorkflows(locale);
  return undefined;
}

/**
 * Deletes a workflow and its run history. Verifies ownership before deleting.
 * @param id - The workflow's database ID.
 * @param locale - Current locale used to revalidate the automations path.
 * @returns An error message object on failure, or undefined on success.
 */
export async function deleteWorkflow(
  id: number,
  locale: string
): Promise<{ error: string } | undefined> {
  const user = await currentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  await db
    .delete(crmWorkflows)
    .where(
      and(eq(crmWorkflows.id, id), eq(crmWorkflows.ownerClerkUserId, user.id))
    );

  revalidateWorkflows(locale);
  return undefined;
}
