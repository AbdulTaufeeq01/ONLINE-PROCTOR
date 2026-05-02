/**
 * Root middleware for Next.js
 * Routes all requests through Supabase authentication middleware
 */
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Exclude static assets, api routes, and _next internals
     * Match all routes except:
     * - api (all api routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder (public assets)
     * - models folder (face-api.js model files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|models).*)',
  ],
};