'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  pass_marks: number;
  status: string;
  starts_at: string | null;
}

interface Invite {
  id: string;
  token: string;
  used: boolean;
  created_at: string;
  exam: Exam;
}

interface Session {
  id: string;
  exam_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

interface Props {
  profile: Profile;
  invites: Invite[];
  sessions: Session[];
}

export function StudentDashboard({ profile, invites, sessions }: Props) {
  const router = useRouter();
  const [loadingLogout, setLoadingLogout] = useState(false);

  const handleLogout = async () => {
    setLoadingLogout(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  // Derive exam state for each invite
  const examCards = invites
    .filter((invite) => invite.exam) // skip invites with no matching exam
    .map((invite) => {
      const session = sessions.find((s) => s.exam_id === invite.exam?.id);

      let state: 'submitted' | 'in_progress' | 'available' | 'expired';

      if (session?.status === 'submitted') {
        state = 'submitted';
      } else if (session?.status === 'in_progress') {
        state = 'in_progress';
      } else if (invite.exam?.status !== 'active') {
        state = 'expired';
      } else {
        state = 'available';
      }

      return { invite, session, state };
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome, {profile.name}
              </h1>
              <p className="mt-2 text-sm text-gray-600">{profile.email}</p>
            </div>
            <Button
              onClick={handleLogout}
              disabled={loadingLogout}
              variant="outline"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {loadingLogout ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {examCards.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">No exams assigned yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {examCards.map(({ invite, session, state }) => {
              let statusConfig: {
                badge: string;
                label: string;
                buttonLabel: string;
                buttonVariant: string;
                href: string;
                disabled?: boolean;
              };

              if (state === 'available') {
                statusConfig = {
                  badge: 'default',
                  label: 'Available',
                  buttonLabel: 'Start Exam',
                  buttonVariant: 'default',
                  href: `/join/${invite.token}`,
                };
              } else if (state === 'in_progress') {
                statusConfig = {
                  badge: 'secondary',
                  label: 'In Progress',
                  buttonLabel: 'Continue Exam',
                  buttonVariant: 'secondary',
                  href: `/student/exam/${invite.exam.id}`,
                };
              } else if (state === 'submitted') {
                statusConfig = {
                  badge: 'outline',
                  label: 'Completed',
                  buttonLabel: 'View Results',
                  buttonVariant: 'outline',
                  href: `/student/results/${session?.id}`,
                };
              } else {
                // expired
                statusConfig = {
                  badge: 'destructive',
                  label: 'Expired',
                  buttonLabel: 'Expired',
                  buttonVariant: 'destructive',
                  href: '#',
                  disabled: true,
                };
              }

              return (
                <Card key={invite.id} className="flex flex-col p-6">
                  {/* Exam Title */}
                  <h2 className="mb-2 text-xl font-bold text-gray-900">
                    {invite.exam.title}
                  </h2>

                  {/* Description */}
                  {invite.exam.description && (
                    <p className="mb-4 text-sm text-gray-600">
                      {invite.exam.description}
                    </p>
                  )}

                  {/* Exam Details */}
                  <div className="mb-4 space-y-2 border-b pb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-medium text-gray-900">
                        {invite.exam.duration_minutes} minutes
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Pass Marks</span>
                      <span className="font-medium text-gray-900">
                        {invite.exam.pass_marks}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <Badge
                      variant={
                        statusConfig.badge as
                          | 'default'
                          | 'secondary'
                          | 'destructive'
                          | 'outline'
                      }
                    >
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Score if submitted */}
                  {state === 'submitted' && session && (
                    <div className="mb-4 rounded bg-gray-50 p-3">
                      <p className="text-xs text-gray-600">Your Score</p>
                      <p className="text-lg font-bold text-gray-900">
                        {session.score} / {session.max_score}
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-auto">
                    {statusConfig.disabled ? (
                      <Button disabled className="w-full">
                        {statusConfig.buttonLabel}
                      </Button>
                    ) : (
                      <Link href={statusConfig.href} className="block w-full">
                        <Button
                          variant={
                            statusConfig.buttonVariant as
                              | 'default'
                              | 'secondary'
                              | 'destructive'
                              | 'outline'
                          }
                          className="w-full"
                        >
                          {statusConfig.buttonLabel}
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}