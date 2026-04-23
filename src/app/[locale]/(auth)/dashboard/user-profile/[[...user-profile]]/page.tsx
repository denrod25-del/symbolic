import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

type UserProfilePageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: 'User Profile',
};

export default async function UserProfilePage(props: UserProfilePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <p>User profile is not available.</p>;
}
