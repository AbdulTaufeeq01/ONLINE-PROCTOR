import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import TeacherNavbar from '@/components/layout/TeacherNavbar';
import ExamMonitor from '@/components/exam/ExamMonitor';

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Step 1: Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("user", user?.id);

  if (!user) {
    console.log("redirecting because: no authenticated user");
    redirect('/auth/login');
  }

  // Step 2: Fetch and verify exam ownership
  const examCall = supabase.rpc('get_teacher_exam', {
    exam_id_param: id,
    teacher_id_param: user.id
  } as any) as any
  const { data: examData, error: examError } = await examCall

  const exam = examData?.[0] ?? null

  console.log("exam", exam, "error", examError)

  if (!exam) {
    console.log("redirecting because: exam not found or no permission")
    redirect('/teacher/home')
  }

  // Step 3: Fetch exam invites
  const { data: invites = [] } = await (supabase.from('exam_invites') as any)
    .select('*')
    .eq('exam_id', id);

  // Step 4: Fetch exam sessions
  const { data: sessions = [] } = await (supabase.from('exam_sessions') as any)
    .select('*')
    .eq('exam_id', id);

  // Step 5: Fetch flags ordered by created_at descending
  const { data: flags = [] } = await (supabase.from('flags') as any)
    .select('*')
    .eq('exam_id', id)
    .order('created_at', { ascending: false });

  // Step 6: Fetch profiles for the students in sessions
  const studentIds = sessions.map((s: any) => s.student_id).filter(Boolean);
  const { data: profiles = [] } = studentIds.length > 0
    ? await (supabase.from('profiles') as any)
        .select('*')
        .in('id', studentIds)
    : { data: [] };

  // Step 7: Fetch total questions for this exam
  const { data: questions = [] } = await (supabase.from('questions') as any)
    .select('id')
    .eq('exam_id', id);

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNavbar />
      <ExamMonitor
        exam={exam}
        initialSessions={sessions ?? []}
        initialInvites={invites ?? []}
        initialFlags={flags ?? []}
        initialProfiles={profiles ?? []}
        totalQuestions={questions?.length ?? 0}
      />
    </div>
  );
}
