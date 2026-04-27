import { SignUp } from '@clerk/nextjs';

export default async function SignUpPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
      <SignUp forceRedirectUrl={`/${locale}/advertise/dashboard`} />
    </div>
  );
}
