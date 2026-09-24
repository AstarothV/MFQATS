'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ROLE_HOME: Record<string, string> = {
  admin: '/admin-dashboard',
  staff: '/staff-dashboard',
  customer: '/customer-dashboard',
};

export async function getRedirectPath() {
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

    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('User fetch error:', error);
      throw new Error('Failed to fetch user');
    }

    if (!user) {
      throw new Error('No user found');
    }

    // Try to get role from user_profiles table
    let userRole = user.user_metadata?.role || 'staff';
    
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profileData?.role) {
        userRole = profileData.role;
      }
    } catch (profileError) {
      console.warn('Profile fetch failed, using metadata role:', profileError);
    }

    const redirectPath = ROLE_HOME[userRole] || '/staff-dashboard';
    console.log('Server action: Redirecting to', redirectPath, 'with role:', userRole);
    
    return redirectPath;
  } catch (error) {
    console.error('Redirect path error:', error);
    throw error;
  }
}
