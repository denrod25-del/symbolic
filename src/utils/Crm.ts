/** Ordered sales pipeline stages shared by CRM actions and the pipeline board. */
export const CRM_STAGES = [
  'lead',
  'contacted',
  'qualified',
  'won',
  'lost',
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

/** Stages that count as still-open opportunities (not yet won or lost). */
export const CRM_OPEN_STAGES: readonly CrmStage[] = [
  'lead',
  'contacted',
  'qualified',
];

/**
 * Narrows an arbitrary string to a known pipeline stage.
 * @param value - The candidate stage string.
 * @returns Whether the value is a valid `CrmStage`.
 */
export function isCrmStage(value: string): value is CrmStage {
  return (CRM_STAGES as readonly string[]).includes(value);
}

/** Lifecycle states for a booked appointment. */
export const CRM_APPOINTMENT_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
] as const;

export type CrmAppointmentStatus = (typeof CRM_APPOINTMENT_STATUSES)[number];

/**
 * Narrows an arbitrary string to a known appointment status.
 * @param value - The candidate status string.
 * @returns Whether the value is a valid `CrmAppointmentStatus`.
 */
export function isCrmAppointmentStatus(
  value: string
): value is CrmAppointmentStatus {
  return (CRM_APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

/** Channels a message can be sent through. */
export const CRM_MESSAGE_CHANNELS = ['sms', 'email'] as const;

export type CrmMessageChannel = (typeof CRM_MESSAGE_CHANNELS)[number];

/**
 * Narrows an arbitrary string to a known message channel.
 * @param value - The candidate channel string.
 * @returns Whether the value is a valid `CrmMessageChannel`.
 */
export function isCrmMessageChannel(value: string): value is CrmMessageChannel {
  return (CRM_MESSAGE_CHANNELS as readonly string[]).includes(value);
}

/** Delivery states a message can hold across its lifecycle. */
export const CRM_MESSAGE_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'received',
] as const;

export type CrmMessageStatus = (typeof CRM_MESSAGE_STATUSES)[number];

/**
 * Narrows an arbitrary string to a known message status.
 * @param value - The candidate status string.
 * @returns Whether the value is a valid `CrmMessageStatus`.
 */
export function isCrmMessageStatus(value: string): value is CrmMessageStatus {
  return (CRM_MESSAGE_STATUSES as readonly string[]).includes(value);
}

/** Lifecycle states for a customer quote/estimate. */
export const CRM_QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'declined',
] as const;

export type CrmQuoteStatus = (typeof CRM_QUOTE_STATUSES)[number];

/**
 * Narrows an arbitrary string to a known quote status.
 * @param value - The candidate status string.
 * @returns Whether the value is a valid `CrmQuoteStatus`.
 */
export function isCrmQuoteStatus(value: string): value is CrmQuoteStatus {
  return (CRM_QUOTE_STATUSES as readonly string[]).includes(value);
}

/** A single priced line on a quote. Amounts are in integer minor units. */
export type CrmQuoteLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

/**
 * Sums quote line items into a total in minor currency units.
 * @param items - The quote's line items.
 * @returns The combined price across all line items.
 */
export function quoteLineItemsTotal(
  items: readonly CrmQuoteLineItem[]
): number {
  return items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice),
    0
  );
}

/** Events that can start an automation workflow. */
export const CRM_WORKFLOW_TRIGGERS = [
  'contact_created',
  'opportunity_stage_changed',
  'appointment_booked',
] as const;

export type CrmWorkflowTrigger = (typeof CRM_WORKFLOW_TRIGGERS)[number];

/** Actions a workflow can run when its trigger fires. */
export const CRM_WORKFLOW_ACTIONS = [
  'send_message',
  'create_opportunity',
] as const;

export type CrmWorkflowAction = (typeof CRM_WORKFLOW_ACTIONS)[number];

/**
 * Narrows an arbitrary string to a known workflow trigger.
 * @param value - The candidate trigger string.
 * @returns Whether the value is a valid `CrmWorkflowTrigger`.
 */
export function isCrmWorkflowTrigger(
  value: string
): value is CrmWorkflowTrigger {
  return (CRM_WORKFLOW_TRIGGERS as readonly string[]).includes(value);
}

/**
 * Narrows an arbitrary string to a known workflow action.
 * @param value - The candidate action string.
 * @returns Whether the value is a valid `CrmWorkflowAction`.
 */
export function isCrmWorkflowAction(value: string): value is CrmWorkflowAction {
  return (CRM_WORKFLOW_ACTIONS as readonly string[]).includes(value);
}

/** Outcomes recorded for a single workflow execution. */
export const CRM_WORKFLOW_RUN_STATUSES = [
  'success',
  'failed',
  'skipped',
] as const;

export type CrmWorkflowRunStatus = (typeof CRM_WORKFLOW_RUN_STATUSES)[number];

/**
 * Narrows an arbitrary string to a known workflow run status.
 * @param value - The candidate status string.
 * @returns Whether the value is a valid `CrmWorkflowRunStatus`.
 */
export function isCrmWorkflowRunStatus(
  value: string
): value is CrmWorkflowRunStatus {
  return (CRM_WORKFLOW_RUN_STATUSES as readonly string[]).includes(value);
}
