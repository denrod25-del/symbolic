import createMiddleware from 'next-intl/middleware';
import { routing } from './libs/I18nRouting';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
