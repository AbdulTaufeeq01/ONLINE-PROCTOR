import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Profile } from '@/types/database';
import { StudentDashboard } from '@/components/student/StudentDashboard';

export default async function StudentHomePage() {
  const supabase = await createSupabaseServerClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    redirect('/auth/login');
  }

  console.log('user email:', user.email);

  // Fetch user profile and verify role
  const { data: profile, error: profileError } = await (supabase.from('profiles') as any)
    .select('id, name, email, role')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: any };

  if (!profile || profileError || profile.role !== 'student') {
    redirect('/teacher/home');
  }

  // Fetch all exam invites for this student
  const { data: rawInvites, error: invitesError } = await (supabase.rpc as any)('get_student_invites', { 
    student_email_param: user.email 
  });

  console.log('invitesError:', invitesError);
  console.log('rawInvites:', rawInvites);

  const examInvites = rawInvites ?? [];

  // Fetch exams for each invite
  const examIds = examInvites.map((invite: any) => invite.exam_id);

  const { data: rawExams, error: examsError } = examIds.length > 0
    ? await (supabase.rpc as any)('get_student_exams', {
        exam_ids: examIds
      })
    : { data: [], error: null };

  console.log("examsError:", examsError);
  console.log("rawExams:", rawExams);

  const exams = rawExams ?? [];

  // Fetch exam sessions to know which exams are already attempted
  const { data: rawSessions, error: sessionsError } = 
    await (supabase.rpc as any)('get_student_sessions', {
      student_id_param: user.id
    });

  console.log("sessionsError:", sessionsError);
  console.log("rawSessions:", rawSessions);

  const examSessions = rawSessions ?? [];

  // Combine exam invites with related exams
  const invitesWithExams = examInvites.map((invite: any) => ({
    ...invite,
    exam: exams.find((e: any) => e.id === invite.exam_id),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentDashboard
        profile={profile}
        invites={invitesWithExams}
        sessions={examSessions}
      />
    </div>
  );
}