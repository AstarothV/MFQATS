import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const ROLE_HOME: Record<string, string> = {
  admin: '/admin-dashboard',
  staff: '/staff-dashboard',
  customer: '/customer-dashboard',
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // First, try to get user from session cookies
    let { data: { user }, error } = await supabase.auth.getUser();

    // If no user session, try to extract token from header (fallback for client-side auth)
    if (error || !user) {
      const token = request.headers.get('x-sb-token');
      if (token) {
        try {
          // Create a new client with the token for this request
          const supabaseWithToken = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll() {
                  // Return the token as a cookie for this request
                  return [
                    { name: `sb-${getProjectRef()}-auth-token`, value: token },
                    ...cookieStore.getAll(),
                  ];
                },
                setAll(cookiesToSet) {
                  cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                  });
                },
              },
            }
          );
          
          const result = await supabaseWithToken.auth.getUser();
          user = result.data.user;
          error = result.error;
        } catch (tokenError) {
          console.error('Token-based auth failed:', tokenError);
        }
      }
    }

    if (error) {
      console.error('Supabase auth error:', error);
      return NextResponse.json(
        { error: 'Auth verification failed' },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Try to get role from user_profiles table
    let userRole = user.user_metadata?.role || 'staff';
    
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('Profile fetch failed, using metadata role:', profileError.message);
    } else if (profileData?.role) {
      userRole = profileData.role;
    }

    const redirectPath = ROLE_HOME[userRole] || '/staff-dashboard';
    
    return NextResponse.json(
      { redirect: redirectPath, role: userRole },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth redirect error:', error);
    return NextResponse.json(
      { error: 'Auth check failed' },
      { status: 500 }
    );
  }
}

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}
