import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { routing } from '@/libs/I18nRouting';

const handleI18nRouting = createIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  '/:locale/advertise/dashboard(.*)',
  '/:locale/advertise/ads(.*)',
  '/:locale/advertise/create(.*)',
  '/:locale/advertise/billing(.*)',
  '/:locale/crm(.*)',
  '/:locale/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Top-level API routes live outside `[locale]`. Passing them through the
  // i18n middleware rewrites /api/* to /en/api/*, which does not exist.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  return handleI18nRouting(req);
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
