import type { MetadataRoute } from 'next';
import { routing } from '@/libs/I18nRouting';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';

// Public, crawlable pages only. /search is excluded because its content comes
// from a query string, /settings and the advertiser, admin and CRM areas sit
// behind auth.
const PUBLIC_ROUTES = ['', '/discover', '/weather', '/submit', '/privacy'];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();

  return PUBLIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    alternates: {
      languages: Object.fromEntries(
        routing.locales
          .filter((locale) => locale !== routing.defaultLocale)
          .map((locale) => [locale, `${baseUrl}${getI18nPath(route, locale)}`])
      ),
    },
  }));
}
