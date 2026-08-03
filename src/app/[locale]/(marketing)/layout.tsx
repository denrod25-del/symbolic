import { Footer } from '@/components/Footer';
import { WeatherChip } from '@/components/WeatherChip';

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  return (
    <>
      <WeatherChip locale={locale} />
      <main>{props.children}</main>
      <Footer locale={locale} />
    </>
  );
}
