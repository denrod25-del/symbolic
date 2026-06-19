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
