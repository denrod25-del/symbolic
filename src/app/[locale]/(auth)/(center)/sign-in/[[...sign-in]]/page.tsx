import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

type SignInPageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: 'Sign In',
};

export default async function SignInPage(props: SignInPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <p>Sign in is not available.</p>;
}
