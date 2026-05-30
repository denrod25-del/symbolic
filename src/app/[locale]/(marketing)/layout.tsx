import { Footer } from '@/components/Footer';

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  return (
    <>
      <main>{props.children}</main>
      <Footer locale={locale} />
    </>
  );
}
