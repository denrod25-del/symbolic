import { and, eq } from 'drizzle-orm';
import * as z from 'zod';
import {
  crmContacts,
  crmMessages,
  crmOpportunities,
  crmWorkflowRuns,
  crmWorkflows,
} from '@/models/Schema';
import { CRM_MESSAGE_CHANNELS } from '@/utils/Crm';
import { db } from './DB';
import { dispatchMessage } from './messaging';

export type WorkflowEvent =
  | { type: 'contact_created'; ownerClerkUserId: string; contactId: number }
  | {
      type: 'opportunity_stage_changed';
      ownerClerkUserId: string;
      contactId: number | null;
      stage: string;
    }
  | {
      type: 'appointment_booked';
      ownerClerkUserId: string;
      contactId: number | null;
    }
  | {
      type: 'invoice_paid';
      ownerClerkUserId: string;
      contactId: number | null;
    };

type Workflow = typeof crmWorkflows.$inferSelect;

const sendMessageConfig = z.object({
  channel: z.enum(CRM_MESSAGE_CHANNELS),
  subject: z.string().optional(),
  body: z.string().min(1),
});

const createOpportunityConfig = z.object({
  title: z.string().min(1),
  value: z.number().int().min(0).default(0),
});

const requestReviewConfig = z.object({
  channel: z.enum(CRM_MESSAGE_CHANNELS),
  reviewUrl: z.string().min(1),
});

type RunOutcome = { status: 'success' | 'failed' | 'skipped'; detail: string };

async function logRun(
  event: WorkflowEvent,
  workflowId: number,
  outcome: RunOutcome
) {
  await db.insert(crmWorkflowRuns).values({
    ownerClerkUserId: event.ownerClerkUserId,
    workflowId,
    contactId: event.contactId,
    status: outcome.status,
    detail: outcome.detail,
  });
}

/**
 * Checks whether a workflow's trigger config matches the incoming event.
 * @param workflow - The workflow whose trigger config is evaluated.
 * @param event - The CRM event being matched against.
 * @returns Whether the workflow should run for this event.
 */
function triggerMatches(workflow: Workflow, event: WorkflowEvent): boolean {
  if (event.type === 'opportunity_stage_changed') {
    const target = workflow.triggerConfig.stage;
    return typeof target !== 'string' || target === event.stage;
  }
  return true;
}

type DeliverMessage = {
  channel: (typeof CRM_MESSAGE_CHANNELS)[number];
  subject: string | null;
  body: string;
};

/**
 * Sends a message to the event's contact and records it in the inbox.
 * @param event - The CRM event whose contact is messaged.
 * @param message - The channel, subject, and body to deliver.
 * @returns The run outcome for the workflow log.
 */
async function deliverToContact(
  event: WorkflowEvent,
  message: DeliverMessage
): Promise<RunOutcome> {
  const { contactId } = event;
  if (contactId === null) {
    return { status: 'skipped', detail: 'No contact to message' };
  }

  const [contact] = await db
    .select()
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.ownerClerkUserId, event.ownerClerkUserId)
      )
    )
    .limit(1);

  if (!contact) {
    return { status: 'skipped', detail: 'Contact not found' };
  }

  const { channel, body } = message;
  const to = channel === 'email' ? contact.email : contact.phone;
  if (!to) {
    return {
      status: 'skipped',
      detail:
        channel === 'email' ? 'Contact has no email' : 'Contact has no phone',
    };
  }

  const subject = channel === 'email' ? message.subject : null;
  const result = await dispatchMessage({ channel, to, subject, body });

  await db.insert(crmMessages).values({
    ownerClerkUserId: event.ownerClerkUserId,
    contactId,
    channel,
    direction: 'outbound',
    subject,
    body,
    status: result.status,
    providerId: result.providerId,
  });

  return result.status === 'failed'
    ? { status: 'failed', detail: 'Message delivery failed' }
    : { status: 'success', detail: `Sent ${channel} to ${contact.name}` };
}

async function runSendMessage(
  workflow: Workflow,
  event: WorkflowEvent
): Promise<RunOutcome> {
  const parsed = sendMessageConfig.safeParse(workflow.actionConfig);
  if (!parsed.success) {
    return { status: 'failed', detail: 'Invalid message configuration' };
  }

  const trimmedSubject = parsed.data.subject?.trim() ?? '';
  const outcome = await deliverToContact(event, {
    channel: parsed.data.channel,
    subject: trimmedSubject === '' ? null : trimmedSubject,
    body: parsed.data.body,
  });
  return outcome;
}

async function runRequestReview(
  workflow: Workflow,
  event: WorkflowEvent
): Promise<RunOutcome> {
  const parsed = requestReviewConfig.safeParse(workflow.actionConfig);
  if (!parsed.success) {
    return { status: 'failed', detail: 'Invalid review configuration' };
  }

  const outcome = await deliverToContact(event, {
    channel: parsed.data.channel,
    subject: 'How did we do?',
    body: `Thanks for your business! We'd love a quick review: ${parsed.data.reviewUrl}`,
  });
  return outcome;
}

async function runCreateOpportunity(
  workflow: Workflow,
  event: WorkflowEvent
): Promise<RunOutcome> {
  const parsed = createOpportunityConfig.safeParse(workflow.actionConfig);
  if (!parsed.success) {
    return { status: 'failed', detail: 'Invalid opportunity configuration' };
  }

  await db.insert(crmOpportunities).values({
    ownerClerkUserId: event.ownerClerkUserId,
    contactId: event.contactId,
    title: parsed.data.title,
    stage: 'lead',
    value: parsed.data.value,
  });

  return {
    status: 'success',
    detail: `Created opportunity "${parsed.data.title}"`,
  };
}

async function executeWorkflow(workflow: Workflow, event: WorkflowEvent) {
  let outcome: RunOutcome;
  if (workflow.actionType === 'send_message') {
    outcome = await runSendMessage(workflow, event);
  } else if (workflow.actionType === 'request_review') {
    outcome = await runRequestReview(workflow, event);
  } else if (workflow.actionType === 'create_opportunity') {
    outcome = await runCreateOpportunity(workflow, event);
  } else {
    outcome = { status: 'failed', detail: 'Unknown action' };
  }

  await logRun(event, workflow.id, outcome);
}

/**
 * Runs every active workflow whose trigger matches the event. Each workflow is
 * isolated so one failure never blocks the others, and the function never
 * throws back into the calling action.
 * @param event - The CRM event that may start workflows.
 */
export async function runWorkflows(event: WorkflowEvent) {
  const workflows = await db
    .select()
    .from(crmWorkflows)
    .where(
      and(
        eq(crmWorkflows.ownerClerkUserId, event.ownerClerkUserId),
        eq(crmWorkflows.triggerType, event.type),
        eq(crmWorkflows.active, true)
      )
    );

  for (const workflow of workflows) {
    if (!triggerMatches(workflow, event)) {
      continue;
    }
    try {
      await executeWorkflow(workflow, event);
    } catch {
      await logRun(event, workflow.id, {
        status: 'failed',
        detail: 'Unexpected error',
      }).catch(() => {
        // swallow logging failures so the engine never throws
      });
    }
  }
}
