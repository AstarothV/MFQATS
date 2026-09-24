import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

const ROLE_ROUTES: Record<string, string[]> = {
  admin: [
    '/admin-dashboard',
    '/real-time-production-dashboard',
    '/catalog',
    '/orders',
    '/admin',
  ],
  staff: [
    '/staff-dashboard',
    '/staff',
  ],
  customer: [
    '/customer-dashboard',
    '/support',
  ],
};

// Routes ONLY customers can access (admin/staff blocked)
const CUSTOMER_ONLY_ROUTES = [
  '/customer-dashboard/shop',
  '/customer-dashboard/order-status',
];

const ROLE_HOME: Record<string, string> = {
  admin: '/admin-dashboard',
  staff: '/staff-dashboard',
  customer: '/customer-dashboard',
};

const PUBLIC_PATHS = [
  '/sign-up-login-screen',
  '/auth',
  '/_next',
  '/favicon.ico',
  '/assets',
  '/api/auth',
  '/landing',
];

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
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
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // Root path: show landing page (no auth required)
  if (pathname === '/') {
    return supabaseResponse;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      const hasCookies = request.cookies.getAll().some((c) => c.name.includes('auth'));
      if (!hasCookies) {
        const url = request.nextUrl.clone();
        url.pathname = '/sign-up-login-screen';
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    // Fetch user role from user_profiles table
    let userRole = 'staff'; // default fallback
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profileData?.role) {
        userRole = profileData.role;
      }
    } catch (err) {
      console.warn('Failed to fetch user role from database:', err);
      // Fall back to default 'staff' role
    }

    // Enforce: admin/staff CANNOT access customer-only ordering routes
    if (CUSTOMER_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
      if (userRole !== 'customer') {
        const url = request.nextUrl.clone();
        url.pathname = ROLE_HOME[userRole] || '/staff-dashboard';
        return NextResponse.redirect(url);
      }
    }

    // Check role-based route access
    const allowedPrefixes = ROLE_ROUTES[userRole] || [];
    const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));

    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = ROLE_HOME[userRole] || '/staff-dashboard';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    console.warn('Middleware auth check error (non-blocking):', error);
    return supabaseResponse;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
