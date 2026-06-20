import { currentUser } from '@clerk/nextjs/server';
import { asc, eq } from 'drizzle-orm';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { db } from '@/libs/DB';
import { crmAppointments, crmContacts } from '@/models/Schema';
import { isCrmAppointmentStatus } from '@/utils/Crm';
import { AppointmentForm } from './AppointmentForm';
import { AppointmentList } from './AppointmentList';

export default async function CrmCalendarPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('CrmCalendarPage');

  const user = await currentUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }

  const rows = await db
    .select({
      id: crmAppointments.id,
      title: crmAppointments.title,
      startAt: crmAppointments.startAt,
      endAt: crmAppointments.endAt,
      status: crmAppointments.status,
      notes: crmAppointments.notes,
      contactId: crmAppointments.contactId,
      contactName: crmContacts.name,
    })
    .from(crmAppointments)
    .leftJoin(crmContacts, eq(crmAppointments.contactId, crmContacts.id))
    .where(eq(crmAppointments.ownerClerkUserId, user.id))
    .orderBy(asc(crmAppointments.startAt));

  const appointments = rows.map((row) => ({
    id: row.id,
    title: row.title,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    status: isCrmAppointmentStatus(row.status) ? row.status : 'scheduled',
    notes: row.notes ?? '',
    contactId: row.contactId,
    contactName: row.contactName,
  }));

  const contacts = await db
    .select({ id: crmContacts.id, name: crmContacts.name })
    .from(crmContacts)
    .where(eq(crmContacts.ownerClerkUserId, user.id))
    .orderBy(asc(crmContacts.name));

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' && new Date(a.startAt).getTime() >= now
  );
  const past = appointments.filter(
    (a) => a.status !== 'scheduled' || new Date(a.startAt).getTime() < now
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-10 rounded-lg border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('book_heading')}
        </h2>
        <AppointmentForm contacts={contacts} locale={locale} />
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('upcoming_heading')}
        </h2>
        <AppointmentList
          appointments={upcoming}
          contacts={contacts}
          emptyLabel={t('upcoming_empty')}
          locale={locale}
        />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-white/70">
          {t('past_heading')}
        </h2>
        <AppointmentList
          appointments={past}
          contacts={contacts}
          emptyLabel={t('past_empty')}
          locale={locale}
        />
      </section>
    </div>
  );
}
