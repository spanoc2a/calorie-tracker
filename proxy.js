import { NextResponse } from 'next/server';

export function proxy(req) {
  const host = req.headers.get('host') || '';
  const { pathname } = req.nextUrl;
  const session = req.cookies.get('session')?.value;

  // Sur nutrainer.io, la racine affiche la landing
  const isRootDomain = host === 'www.nutrainer.io' || host === 'nutrainer.io';
  if (isRootDomain && pathname === '/') {
    return NextResponse.rewrite(new URL('/landing', req.url));
  }

  // Sur app.nutrainer.io, bloquer l'accès à la landing
  const isAppDomain = host === 'app.nutrainer.io';
  if (isAppDomain && pathname === '/landing') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Pages publiques — accessibles sans authentification
  const publicPages = ['/landing', '/login', '/cgu', '/privacy'];
  const isPublicPage = publicPages.some(p => pathname.startsWith(p));

  if (!session) {
    const publicApi = ['/api/auth/', '/api/strava/debug', '/api/coach/lookup', '/api/push/', '/api/og'];
    const isPublicApi = publicApi.some(p => pathname.startsWith(p));
    if (pathname.startsWith('/api/') && !isPublicApi) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!pathname.startsWith('/api/') && !isPublicPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon|apple-touch|manifest|sw\\.js|favicon|\\.well-known).*)'],
};
