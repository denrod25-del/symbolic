import { redirect } from 'next/navigation';

/**
 * Redirects the bare CRM route to the dashboard, which is the module's entry point.
 */
export default function CrmPage() {
  redirect('/crm/dashboard');
}
