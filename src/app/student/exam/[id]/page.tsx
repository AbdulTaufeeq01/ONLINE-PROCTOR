import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ExamTaker } from '@/components/student/ExamTaker';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function StudentExamPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    redirect('/auth/login');
  }

  // Fetch exam
  const { data: examData, error: examError } =
    await supabase.rpc('get_exam_by_id', { exam_id_param: id });

  const exam = examData?.[0] ?? null;

  if (!exam) redirect('/student/home');

  // Fetch session
  const { data: sessionData } =
    await supabase.rpc('get_student_sessions', { student_id_param: user.id });

  const session =
    (sessionData ?? []).find(
      (s: any) => s.exam_id === id && s.status === 'in_progress'
    ) ?? null;

  if (!session) redirect('/student/home');
  if (session.status === 'submitted') redirect(`/student/results/${session.id}`);

  // Fetch questions and normalize options
  const { data: rawQuestions } =
    await supabase.rpc('get_exam_questions', { exam_id_param: id });

  const questions = (rawQuestions ?? []).map((q: any) => {
    let options = null;
    if (q.options) {
      if (typeof q.options === 'string') {
        try {
          const parsed = JSON.parse(q.options);
          options = Array.isArray(parsed)
            ? parsed.map((o: any) =>
                typeof o === 'object'
                  ? o.value ?? o.label ?? String(o)
                  : String(o)
              )
            : null;
        } catch {
          options = null;
        }
      } else if (Array.isArray(q.options)) {
        options = q.options.map((o: any) =>
          typeof o === 'object'
            ? o.value ?? o.label ?? String(o)
            : String(o)
        );
      }
    }
    return { ...q, options };
  });

  // Fetch invite
  const { data: inviteData } = await supabase
    .rpc('get_invite_by_token', {
      token_param: session.invite_id,
    });

  const invite = inviteData?.[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-900">
      <ExamTaker
        exam={exam}
        session={session}
        questions={questions}
        invite={invite}
      />
    </div>
  );
}