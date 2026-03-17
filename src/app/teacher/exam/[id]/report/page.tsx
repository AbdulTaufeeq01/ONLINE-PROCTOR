import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import TeacherNavbar from '@/components/layout/TeacherNavbar';
import { ExamReport } from '@/components/exam/ExamReport';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ExamReportPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    redirect('/auth/login');
  }

  // Fetch exam and verify ownership
  const examCall = supabase.rpc('get_teacher_exam', {
    exam_id_param: id,
    teacher_id_param: user.id
  } as any) as any
  const { data: examData, error: examError } = await examCall

  const exam = examData?.[0] ?? null

  if (!exam) {
    redirect('/teacher/home')
  }

  // Fetch all questions
  const { data: questions = [] } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', id)
    .order('order_index', { ascending: true });

  // Fetch all exam sessions
  const { data: examSessions = [] } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('exam_id', id);

  // Fetch all exam invites
  const { data: examInvites = [] } = await supabase
    .from('exam_invites')
    .select('*')
    .eq('exam_id', id);

  // Fetch all flags
  const { data: flags = [] } = await supabase
    .from('flags')
    .select('*')
    .eq('exam_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNavbar />
      <ExamReport
        exam={exam}
        questions={questions}
        initialSessions={examSessions}
        initialInvites={examInvites}
        initialFlags={flags}
      />
    </div>
  );
}
