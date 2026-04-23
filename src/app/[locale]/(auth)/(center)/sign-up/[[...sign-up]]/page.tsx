import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

type SignUpPageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: 'Sign Up',
};

export default async function SignUpPage(props: SignUpPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <p>Sign up is not available.</p>;
}
