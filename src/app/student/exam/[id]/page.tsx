import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Exam, ExamSession } from '@/types/database';
import { ExamTaker } from '@/components/student/ExamTaker';

export const dynamic = 'force-dynamic';

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

  if (!user || userError) redirect('/auth/login');

  // ── Fetch exam directly (no RPC) ──────────────────────────────────────────
  const { data: exam, error: examError } = await (supabase.from('exams') as any)
    .select(
      'id, title, duration_minutes, webcam_required, fullscreen_required, shuffle_questions, status'
    )
    .eq('id', id)
    .single() as { data: Exam | null; error: any };

  if (!exam || examError) redirect('/student/home');
  if (exam.status !== 'active') redirect('/student/home');

  // ── Fetch session directly — accept not_started OR in_progress ───────────
  //    create_exam_session sets status='not_started', so we must allow it here
  const { data: session, error: sessionError } = await (supabase.from('exam_sessions') as any)
    .select('id, exam_id, student_id, invite_id, status, answers, started_at')
    .eq('exam_id', id)
    .eq('student_id', user.id)
    .in('status', ['not_started', 'in_progress'])
    .order('started_at', { ascending: false })
    .maybeSingle() as { data: ExamSession | null; error: any };

  // No active session → go back to dashboard
  if (!session || sessionError) redirect('/student/home');

  // Already submitted → go to results
  if (session.status === 'submitted') redirect(`/student/results/${session.id}`);

  // ── Fetch questions — correct p_ prefix ───────────────────────────────────
  const { data: rawQuestions } = await (supabase.rpc as any)('get_exam_questions', {
    p_exam_id: id,
  });

  const questions = (rawQuestions ?? []).map((q: any) => {
    let options: string[] | null = null;
    if (q.options) {
      if (typeof q.options === 'string') {
        try {
          const parsed = JSON.parse(q.options);
          options = Array.isArray(parsed)
            ? parsed.map((o: any) =>
                typeof o === 'object' ? (o.value ?? o.label ?? String(o)) : String(o)
              )
            : null;
        } catch {
          options = null;
        }
      } else if (Array.isArray(q.options)) {
        options = q.options.map((o: any) =>
          typeof o === 'object' ? (o.value ?? o.label ?? String(o)) : String(o)
        );
      }
    }
    return { ...q, options };
  });

  // ── Fetch invite for student name ─────────────────────────────────────────
  const { data: invite } = session.invite_id
    ? await supabase
        .from('exam_invites')
        .select('id, student_name, student_email')
        .eq('id', session.invite_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-gray-900">
      <ExamTaker
        exam={exam}
        session={session as any}
        questions={questions}
        invite={
          invite ?? {
            id: '',
            student_name: user.email ?? 'Student',
            student_email: user.email ?? '',
          }
        }
      />
    </div>
  );
}