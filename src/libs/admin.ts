import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Env } from './Env';

/**
 * Returns the configured admin emails as a lowercased, trimmed list.
 * @returns Lowercased, trimmed admin email strings.
 */
function adminList(): string[] {
  return (Env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks whether an email address is in the admin allowlist.
 * @param email - The email address to check.
 * @returns True when the email is an allowlisted admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return adminList().includes(email.toLowerCase());
}

/**
 * Returns the current Clerk user when they are an admin, otherwise null.
 * @returns The admin Clerk user, or null.
 */
export async function getAdminUser() {
  const user = await currentUser();
  if (!user) {
    return null;
  }
  return isAdminEmail(user.primaryEmailAddress?.emailAddress) ? user : null;
}

/**
 * Returns the current admin Clerk user, or redirects to sign-in when the
 * caller is not an admin.
 * @param locale - Current locale used to build the sign-in redirect path.
 * @returns The admin Clerk user.
 */
export async function requireAdmin(locale: string) {
  const user = await getAdminUser();
  if (!user) {
    redirect(`/${locale}/advertise/sign-in`);
  }
  return user;
}
