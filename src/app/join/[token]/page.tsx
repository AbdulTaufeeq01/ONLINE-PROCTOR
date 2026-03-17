import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    redirect(`/auth/login?redirect=/join/${token}`);
  }

  // Fetch invite
  const { data: inviteData, error: inviteError } =
    await supabase.rpc('get_invite_by_token', { token_param: token });

  const invite = inviteData?.[0] ?? null;
  if (!invite || inviteError) {
    return <ErrorPage message="Invalid invite link" />;
  }

  // Fetch exam
  const { data: examData, error: examError } =
    await supabase.rpc('get_exam_by_id', { exam_id_param: invite.exam_id });

  const exam = examData?.[0] ?? null;
  if (!exam || examError) {
    return <ErrorPage message="Exam not found" />;
  }

  if (exam.status !== 'active') {
    return <ErrorPage message="This exam is not currently active" />;
  }

  // Check for ANY existing session for this exam first
  const { data: existingSessions } = await supabase.rpc(
    'get_student_sessions', { student_id_param: user.id }
  );

  const existingSession = (existingSessions ?? []).find(
    (s: any) => s.exam_id === invite.exam_id
  );

  if (existingSession) {
    if (existingSession.status === 'submitted') {
      redirect(`/student/results/${existingSession.id}`);
    } else {
      redirect(`/student/exam/${exam.id}`);
    }
  }

  // No existing session — check if invite is used by someone else
  if (invite.used === true) {
    return <ErrorPage message="This invite link has already been used" />;
  }

  // Create session — this also marks invite as used atomically inside the RPC
  const { data: sessionData, error: createSessionError } =
    await supabase.rpc('create_exam_session', {
      exam_id_param: invite.exam_id,
      student_id_param: user.id,
      invite_id_param: invite.id,
    });

  const newSession = sessionData?.[0] ?? null;

  if (!newSession || createSessionError) {
    console.error('create session error:', createSessionError);
    return <ErrorPage message="Failed to create exam session" />;
  }

  redirect(`/student/exam/${exam.id}`);
}