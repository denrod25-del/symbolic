'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteAppointment, setAppointmentStatus } from '@/libs/bookingActions';
import type { CrmAppointmentStatus } from '@/utils/Crm';
import { AppointmentForm } from './AppointmentForm';
import type { AppointmentContact } from './AppointmentForm';

type Appointment = {
  id: number;
  title: string;
  startAt: string;
  endAt: string;
  status: CrmAppointmentStatus;
  notes: string;
  contactId: number | null;
  contactName: string | null;
};

type AppointmentListProps = {
  locale: string;
  appointments: Appointment[];
  contacts: AppointmentContact[];
  emptyLabel: string;
};

const statusStyles: Record<string, string> = {
  scheduled: 'bg-indigo-500/15 text-indigo-300',
  completed: 'bg-green-500/15 text-green-300',
  cancelled: 'bg-white/10 text-white/40',
};

function formatRange(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const day = start.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const startTime = start.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = end.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} · ${startTime}–${endTime}`;
}

function AppointmentRow(props: {
  locale: string;
  appointment: Appointment;
  contacts: AppointmentContact[];
}) {
  const t = useTranslations('CrmAppointmentList');
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { appointment } = props;

  async function changeStatus(status: string) {
    await setAppointmentStatus(appointment.id, status, props.locale);
    router.refresh();
  }

  async function handleDelete() {
    await deleteAppointment(appointment.id, props.locale);
    router.refresh();
  }

  if (isEditing) {
    return (
      <li className="rounded-lg border border-white/10 bg-white/5 p-4">
        <AppointmentForm
          contacts={props.contacts}
          initial={{
            id: appointment.id,
            title: appointment.title,
            contactId: appointment.contactId,
            startAt: appointment.startAt,
            endAt: appointment.endAt,
            notes: appointment.notes,
          }}
          locale={props.locale}
          onSaved={() => {
            setIsEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-4 p-4">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium">{appointment.title}</p>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
              statusStyles[appointment.status] ?? 'bg-white/10 text-white/40'
            }`}
          >
            {t(`status_${appointment.status}`)}
          </span>
        </div>
        <p className="text-sm text-white/50">
          {formatRange(appointment.startAt, appointment.endAt)}
          {appointment.contactName ? ` · ${appointment.contactName}` : ''}
        </p>
        {appointment.notes ? (
          <p className="mt-1 text-sm text-white/40">{appointment.notes}</p>
        ) : null}
      </div>

      {isConfirmingDelete ? (
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
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          {appointment.status === 'scheduled' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                }}
                className="text-sm text-indigo-400 hover:underline"
              >
                {t('reschedule')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await changeStatus('completed');
                }}
                className="text-sm text-green-400 hover:text-green-300"
              >
                {t('complete')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await changeStatus('cancelled');
                }}
                className="text-sm text-white/50 hover:text-white"
              >
                {t('cancel_appointment')}
              </button>
            </>
          ) : null}
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
      )}
    </li>
  );
}

export function AppointmentList(props: AppointmentListProps) {
  if (props.appointments.length === 0) {
    return <p className="text-sm text-white/40">{props.emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
      {props.appointments.map((appointment) => (
        <AppointmentRow
          appointment={appointment}
          contacts={props.contacts}
          key={appointment.id}
          locale={props.locale}
        />
      ))}
    </ul>
  );
}
