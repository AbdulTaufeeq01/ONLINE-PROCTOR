import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import TeacherNavbar from '@/components/layout/TeacherNavbar';
import InviteManager from '@/components/exam/InviteManager';

interface Exam {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'ended';
}

interface ExamInvite {
  id: string;
  exam_id: string;
  student_email: string;
  student_name: string | null;
  token: string;
  used: boolean;
  created_at: string;
}

interface InvitePageProps {
  params: Promise<{ id: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { id: examId } = await params;
  const supabase = await createSupabaseServerClient();

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/auth/login');
  }

  // Fetch exam - verify it belongs to the current teacher
  const examCall = supabase.rpc('get_teacher_exam', {
    exam_id_param: examId,
    teacher_id_param: user.id
  } as any) as any
  const { data: examData, error: examError } = await examCall

  const exam = examData?.[0] ?? null

  if (!exam) {
    redirect('/teacher/home')
  }

  // Fetch exam invites
  const { data: invitesData, error: invitesError } = 
    await (supabase.rpc as any)('get_teacher_invites', {
      exam_id_param: examId,
      teacher_id_param: user.id
    })

  console.log("invitesError:", invitesError)
  const invitesList: ExamInvite[] = invitesData ?? []

  return (
    <>
      <TeacherNavbar />
      <div className="min-h-screen bg-gray-50">
        <InviteManager exam={exam} invites={invitesList} />
      </div>
    </>
  );
}
