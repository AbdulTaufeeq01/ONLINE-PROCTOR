'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function TeacherNavbar() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getUserEmail = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          console.error('Failed to fetch user:', error);
          return;
        }
        setUserEmail(user.email ?? null);
      } catch (error) {
        console.error('Error fetching user email:', error);
      }
    };

    getUserEmail();
  }, [supabase.auth]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message || 'Failed to logout');
        setIsLoading(false);
        return;
      }
      toast.success('Logged out successfully');
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4 flex justify-between items-center">
        {/* Left: Logo */}
        <Link href="/teacher/home">
          <h1 className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
            ProctorApp
          </h1>
        </Link>

        {/* Right: User Email + Logout Button */}
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-sm font-medium text-gray-700">
              {userEmail}
            </span>
          )}
          <Button
            onClick={handleLogout}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2"
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </Button>
        </div>
      </div>
    </nav>
  );
}
