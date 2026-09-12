import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/utils/Helpers';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth-only areas and the query-driven results pages. Crawling /search
      // would generate unbounded thin URLs and burn Brave API quota.
      disallow: [
        '/api/',
        '/admin',
        '/advertise',
        '/crm',
        '/settings',
        '/search',
      ],
    },
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
