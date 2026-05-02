import { redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TeacherNavbar from '@/components/layout/TeacherNavbar';

// Force re-fetch on every visit — prevents stale cached data after edits
export const dynamic = 'force-dynamic';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  status: 'draft' | 'active' | 'ended';
  created_at: string;
  question_count?: number;
  session_count?: number;
}

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'draft':
      return 'bg-gray-200 text-gray-800';
    case 'active':
      return 'bg-green-200 text-green-800';
    case 'ended':
      return 'bg-blue-200 text-blue-800';
    default:
      return 'bg-gray-200 text-gray-800';
  }
};

const getStatusLabel = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default async function TeacherHomePage() {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch exams — p_teacher_id matches the RPC function definition
  const { data: exams, error: examsError } = await (supabase.rpc as any)(
    'get_teacher_exams_with_counts',
    { p_teacher_id: user.id }
  );

  if (examsError) {
    console.error('Error fetching exams:', JSON.stringify(examsError, null, 2));
  }

  const examList = (exams ?? []) as Exam[];

  return (
    <main className="min-h-screen bg-gray-50">
      <TeacherNavbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">My Exams</h1>
            <p className="text-gray-600 mt-2">
              Manage and monitor your online exams
            </p>
          </div>
          <Link href="/teacher/exam/create">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2">
              + Create New Exam
            </Button>
          </Link>
        </div>

        {/* Empty State */}
        {examList.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed border-gray-300">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No exams yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create your first exam to get started with online proctoring
              </p>
              <Link href="/teacher/exam/create">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                  Create First Exam
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {examList.map((exam) => (
              <Card
                key={exam.id}
                className="p-6 hover:shadow-lg transition-shadow duration-200 border border-gray-200"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex-1 pr-4">
                    {exam.title}
                  </h2>
                  <Badge
                    className={`${getStatusBadgeColor(exam.status)} font-medium px-3 py-1 text-sm whitespace-nowrap`}
                  >
                    {getStatusLabel(exam.status)}
                  </Badge>
                </div>

                {/* Description */}
                {exam.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {exam.description}
                  </p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-y border-gray-200">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs font-medium uppercase">
                      Duration
                    </p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {exam.duration_minutes}m
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs font-medium uppercase">
                      Questions
                    </p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {exam.question_count ?? 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs font-medium uppercase">
                      Created
                    </p>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {format(new Date(exam.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Link href={`/teacher/exam/${exam.id}/edit`}>
                    <Button className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium text-sm px-4 py-2">
                      Edit
                    </Button>
                  </Link>

                  {exam.status === 'active' && (
                    <Link href={`/teacher/exam/${exam.id}/invite`}>
                      <Button className="bg-blue-100 hover:bg-blue-200 text-blue-900 font-medium text-sm px-4 py-2">
                        Invite Students
                      </Button>
                    </Link>
                  )}

                  {exam.status === 'active' && (
                    <Link href={`/teacher/exam/${exam.id}/monitor`}>
                      <Button className="bg-purple-100 hover:bg-purple-200 text-purple-900 font-medium text-sm px-4 py-2">
                        Monitor
                      </Button>
                    </Link>
                  )}

                  {exam.status === 'ended' && (
                    <Link href={`/teacher/exam/${exam.id}/report`}>
                      <Button className="bg-green-100 hover:bg-green-200 text-green-900 font-medium text-sm px-4 py-2">
                        Report
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}