import { AdWizard } from '@/components/AdWizard';

export default async function CreatePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  return <AdWizard locale={locale} />;
}
