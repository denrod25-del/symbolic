import { SignIn } from '@clerk/nextjs';

export default async function SignInPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
      <SignIn forceRedirectUrl={`/${locale}/advertise/dashboard`} />
    </div>
  );
}
