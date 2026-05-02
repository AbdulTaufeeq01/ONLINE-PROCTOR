import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ExamInvite, Exam, ExamSession } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Props = {
  params: Promise<{ token: string }>;
};

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8 text-center shadow-lg">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Unable to Join Exam
        </h1>
        <p className="mb-8 text-red-600">{message}</p>
        <Link href="/student/home">
          <Button>Go Back to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}

export default async function JoinExamPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    redirect(`/auth/login?redirect=/join/${token}`);
  }

  // Fetch invite directly — avoids RPC param name issues
  const { data: invite, error: inviteError } = await (supabase.from('exam_invites') as any)
    .select('id, exam_id, student_email, student_name, token, used')
    .eq('token', token)
    .single() as { data: ExamInvite | null; error: any };

  if (!invite || inviteError) {
    return <ErrorPage message="Invalid invite link" />;
  }

  // Fetch exam directly
  const { data: exam, error: examError } = await (supabase.from('exams') as any)
    .select('id, title, status, duration_minutes')
    .eq('id', invite.exam_id)
    .single() as { data: Exam | null; error: any };

  if (!exam || examError) {
    return <ErrorPage message="Exam not found" />;
  }

  if (exam.status !== 'active') {
    return <ErrorPage message="This exam is not currently active" />;
  }

  // Check for existing session for this student + exam
  const { data: existingSession } = await (supabase.from('exam_sessions') as any)
    .select('id, status, exam_id')
    .eq('student_id', user.id)
    .eq('exam_id', invite.exam_id)
    .maybeSingle() as { data: ExamSession | null; error: any };

  if (existingSession) {
    if (existingSession.status === 'submitted') {
      redirect(`/student/results/${existingSession.id}`);
    } else {
      redirect(`/student/exam/${exam.id}`);
    }
  }

  // Check if invite already used by someone else
  if (invite.used === true) {
    return <ErrorPage message="This invite link has already been used" />;
  }

  // Create session — p_exam_id, p_student_id, p_invite_id match the RPC definition
  const { data: sessionData, error: createSessionError } =
    await (supabase.rpc as any)('create_exam_session', {
      p_exam_id:    invite.exam_id,
      p_student_id: user.id,
      p_invite_id:  invite.id,
    });

  if (createSessionError || !sessionData?.success) {
    console.error(
      'create session error:',
      createSessionError,
      sessionData
    );
    return (
      <ErrorPage
        message={sessionData?.error || 'Failed to create exam session'}
      />
    );
  }

  redirect(`/student/exam/${exam.id}`);
}