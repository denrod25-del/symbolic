import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function Footer(props: { locale: string }) {
  const t = await getTranslations('Footer');

  return (
    <footer className="border-t border-symbolic-border bg-symbolic-bg py-4 text-center text-sm text-symbolic-muted">
      <Link
        href={`/${props.locale}/discover`}
        className="hover:text-symbolic-text"
      >
        {t('discover')}
      </Link>
      <span className="mx-2">·</span>
      <Link
        href={`/${props.locale}/submit`}
        className="hover:text-symbolic-text"
      >
        {t('submit')}
      </Link>
      <span className="mx-2">·</span>
      <Link
        href={`/${props.locale}/settings`}
        className="hover:text-symbolic-text"
      >
        {t('settings')}
      </Link>
      <span className="mx-2">·</span>
      <Link
        href={`/${props.locale}/privacy`}
        className="hover:text-symbolic-text"
      >
        {t('privacy')}
      </Link>
      <span className="mx-2">·</span>
      <span>{t('copyright')}</span>
    </footer>
  );
}
