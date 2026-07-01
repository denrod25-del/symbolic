import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type RemixlyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: RemixlyPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'RemixlyPage' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function RemixlyPage(props: RemixlyPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations('RemixlyPage');

  const features = [
    { title: t('feature1_title'), body: t('feature1_body') },
    { title: t('feature2_title'), body: t('feature2_body') },
    { title: t('feature3_title'), body: t('feature3_body') },
    { title: t('feature4_title'), body: t('feature4_body') },
  ];

  const steps = [
    { title: t('step1_title'), body: t('step1_body') },
    { title: t('step2_title'), body: t('step2_body') },
    { title: t('step3_title'), body: t('step3_body') },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight">Remixly</span>
        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="hidden text-sm text-white/60 hover:text-white sm:inline"
          >
            {t('nav_features')}
          </a>
          <a
            href="#pricing"
            className="hidden text-sm text-white/60 hover:text-white sm:inline"
          >
            {t('nav_pricing')}
          </a>
          <span className="hidden text-sm text-white/60 sm:inline">
            {t('nav_login')}
          </span>
          <a
            href="#pricing"
            className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-orange-400 px-4 py-2 text-sm font-semibold text-black"
          >
            {t('nav_cta')}
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="mb-4 text-sm font-semibold tracking-widest text-fuchsia-400 uppercase">
          {t('hero_eyebrow')}
        </p>
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
          {t('hero_title')}
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-white/60">
          {t('hero_subtitle')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="#pricing"
            className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-orange-400 px-6 py-3 font-semibold text-black"
          >
            {t('hero_cta_primary')}
          </a>
          <a
            href="#how-it-works"
            className="rounded-lg border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/5"
          >
            {t('hero_cta_secondary')}
          </a>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-16">
        <p className="mb-2 text-center text-sm font-semibold tracking-widest text-fuchsia-400 uppercase">
          {t('steps_eyebrow')}
        </p>
        <h2 className="mb-12 text-center text-3xl font-bold">
          {t('steps_title')}
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <span className="mb-4 flex size-8 items-center justify-center rounded-full bg-fuchsia-500/20 text-sm font-bold text-fuchsia-400">
                {index + 1}
              </span>
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-white/60">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-5xl px-6 py-16">
        <p className="mb-2 text-center text-sm font-semibold tracking-widest text-fuchsia-400 uppercase">
          {t('features_eyebrow')}
        </p>
        <h2 className="mb-12 text-center text-3xl font-bold">
          {t('features_title')}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-white/60">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xl font-medium text-white/90">
          “{t('proof_quote')}”
        </p>
        <p className="mt-4 text-sm text-white/50">{t('proof_caption')}</p>
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-6 py-16">
        <p className="mb-2 text-center text-sm font-semibold tracking-widest text-fuchsia-400 uppercase">
          {t('pricing_eyebrow')}
        </p>
        <h2 className="mb-2 text-center text-3xl font-bold">
          {t('pricing_title')}
        </h2>
        <p className="mb-12 text-center text-white/60">
          {t('pricing_subtitle')}
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-8">
            <h3 className="text-lg font-semibold">{t('plan_solo_name')}</h3>
            <p className="mt-4 mb-2">
              <span className="text-4xl font-bold">{t('plan_solo_price')}</span>
              <span className="text-white/50">{t('plan_solo_period')}</span>
            </p>
            <p className="mb-6 text-sm text-white/60">{t('plan_solo_desc')}</p>
            <ul className="mb-8 space-y-2 text-sm text-white/70">
              <li>{t('plan_solo_feature1')}</li>
              <li>{t('plan_solo_feature2')}</li>
              <li>{t('plan_solo_feature3')}</li>
              <li>{t('plan_solo_feature4')}</li>
            </ul>
            <a
              href="#pricing"
              className="block rounded-lg border border-white/20 px-4 py-3 text-center font-semibold hover:bg-white/5"
            >
              {t('plan_solo_cta')}
            </a>
          </div>
          <div className="rounded-xl border border-fuchsia-400/40 bg-white/5 p-8">
            <h3 className="text-lg font-semibold">{t('plan_studio_name')}</h3>
            <p className="mt-4 mb-2">
              <span className="text-4xl font-bold">
                {t('plan_studio_price')}
              </span>
              <span className="text-white/50">{t('plan_studio_period')}</span>
            </p>
            <p className="mb-6 text-sm text-white/60">
              {t('plan_studio_desc')}
            </p>
            <ul className="mb-8 space-y-2 text-sm text-white/70">
              <li>{t('plan_studio_feature1')}</li>
              <li>{t('plan_studio_feature2')}</li>
              <li>{t('plan_studio_feature3')}</li>
              <li>{t('plan_studio_feature4')}</li>
            </ul>
            <a
              href="#pricing"
              className="block rounded-lg bg-gradient-to-r from-fuchsia-500 to-orange-400 px-4 py-3 text-center font-semibold text-black"
            >
              {t('plan_studio_cta')}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="mb-4 text-3xl font-bold">{t('cta_title')}</h2>
        <p className="mb-8 text-white/60">{t('cta_subtitle')}</p>
        <a
          href="#pricing"
          className="inline-block rounded-lg bg-gradient-to-r from-fuchsia-500 to-orange-400 px-8 py-4 font-semibold text-black"
        >
          {t('cta_button')}
        </a>
      </section>
    </div>
  );
}
