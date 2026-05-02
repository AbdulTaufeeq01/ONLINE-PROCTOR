import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname, searchParams } = request.nextUrl;

  const isTeacher = /^\/teacher/.test(pathname);
  const isStudent = /^\/student/.test(pathname);
  const isJoin    = /^\/join/.test(pathname);
  const isAuth    = pathname === '/auth/login' || pathname === '/auth/register';

  if (!user && (isTeacher || isStudent || isJoin)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', `${pathname}${searchParams.toString() ? `?${searchParams}` : ''}`);
    return NextResponse.redirect(url);
  }

  if (user && isAuth) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'teacher' ? '/teacher/home' : '/student/home';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}