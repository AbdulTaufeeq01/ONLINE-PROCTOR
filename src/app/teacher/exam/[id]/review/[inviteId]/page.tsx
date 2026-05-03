import { redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import TeacherNavbar from '@/components/layout/TeacherNavbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = {
  params: Promise<{ id: string; inviteId: string }>;
};

type QuestionRow = {
  id: string;
  exam_id: string;
  order_index: number;
  type: string;
  question_text: string;
  options: Array<{ value: string; label: string }> | null;
  correct_answer: string;
  marks: number;
};

type ExamInviteRow = {
  id: string;
  exam_id: string;
  student_email: string;
  student_name: string | null;
};

type ExamSessionRow = {
  id: string;
  exam_id: string;
  invite_id: string | null;
  student_id: string | null;
  status: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  answers: Record<string, unknown> | null;
  grading_details: Record<string, any> | null;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
};

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeAnswer(value: unknown): string {
  if (value == null) return 'No answer';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  const text = String(value).trim();
  return text.length > 0 ? text : 'No answer';
}

function isAnswerCorrect(question: QuestionRow, studentAnswer: unknown): boolean | null {
  if (studentAnswer == null) return null;

  if (question.type === 'mcq') {
    return String(studentAnswer).trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
  }

  return null;
}

function clampMarks(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, value));
}

async function saveManualGrades(formData: FormData) {
  'use server';

  const examId = String(formData.get('exam_id') ?? '').trim();
  const inviteId = String(formData.get('invite_id') ?? '').trim();
  const sessionId = String(formData.get('session_id') ?? '').trim();

  if (!examId || !inviteId || !sessionId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const examCall = supabase.rpc('get_teacher_exam', {
    exam_id_param: examId,
    teacher_id_param: user.id,
  } as any) as any;

  const { data: examData } = await examCall;
  const exam = examData?.[0] ?? null;

  if (!exam) {
    redirect('/teacher/home');
  }

  const { data: sessionData } = await (supabase.from('exam_sessions') as any)
    .select('id, exam_id, answers, grading_details')
    .eq('id', sessionId)
    .eq('exam_id', examId)
    .maybeSingle();

  const session = sessionData as {
    id: string;
    exam_id: string;
    answers: Record<string, unknown> | null;
    grading_details: Record<string, any> | null;
  } | null;

  if (!session) {
    return;
  }

  const { data: questionsData = [] } = await (supabase.from('questions') as any)
    .select('id, type, question_text, correct_answer, marks')
    .eq('exam_id', examId)
    .order('order_index', { ascending: true });

  const questions = questionsData as Array<{
    id: string;
    type: string;
    question_text: string;
    correct_answer: string;
    marks: number;
  }>;

  const answers = (session.answers ?? {}) as Record<string, unknown>;
  const existingDetails = (session.grading_details ?? {}) as Record<string, any>;
  const updatedDetails: Record<string, any> = {};

  let totalScore = 0;
  let maxScore = 0;

  for (const question of questions) {
    maxScore += question.marks;

    const raw = formData.get(`marks_${question.id}`);
    const numeric = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : 0;
    const awardedMarks = clampMarks(numeric, question.marks);

    const previous = existingDetails[question.id] ?? {};
    const questionDetail = {
      question_text: previous.question_text ?? question.question_text,
      student_answer: previous.student_answer ?? answers[question.id] ?? null,
      correct_answer: previous.correct_answer ?? question.correct_answer,
      is_correct: previous.is_correct ?? null,
      marks_awarded: awardedMarks,
      needs_grading: false,
      type: previous.type ?? question.type,
      manual_override: true,
    };

    updatedDetails[question.id] = questionDetail;
    totalScore += awardedMarks;
  }

  const roundedScore = Math.round(totalScore * 100) / 100;

  await (supabase.from('exam_sessions') as any)
    .update({
      grading_details: updatedDetails,
      score: roundedScore,
      max_score: maxScore,
    })
    .eq('id', sessionId);

  revalidatePath(`/teacher/exam/${examId}/review/${inviteId}`);
  revalidatePath(`/teacher/exam/${examId}/monitor`);
  revalidatePath(`/teacher/exam/${examId}/student/${inviteId}`);
}

export default async function AnswerReviewPage({ params }: Props) {
  const { id, inviteId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const examCall = supabase.rpc('get_teacher_exam', {
    exam_id_param: id,
    teacher_id_param: user.id,
  } as any) as any;

  const { data: examData } = await examCall;
  const exam = examData?.[0] ?? null;

  if (!exam) {
    redirect('/teacher/home');
  }

  const { data: inviteData } = await (supabase.from('exam_invites') as any)
    .select('id, exam_id, student_email, student_name')
    .eq('id', inviteId)
    .eq('exam_id', id)
    .maybeSingle();

  const invite = inviteData as ExamInviteRow | null;

  if (!invite) {
    redirect(`/teacher/exam/${id}/monitor`);
  }

  const { data: sessionData } = await (supabase.from('exam_sessions') as any)
    .select('id, exam_id, invite_id, student_id, status, submitted_at, score, max_score, answers, grading_details')
    .eq('exam_id', id)
    .eq('invite_id', inviteId)
    .maybeSingle();

  const session = sessionData as ExamSessionRow | null;

  const { data: profileData } = session?.student_id
    ? await (supabase.from('profiles') as any)
        .select('id, name, email')
        .eq('id', session.student_id)
        .maybeSingle()
    : { data: null };

  const profile = profileData as ProfileRow | null;

  const { data: questionsData = [] } = await (supabase.from('questions') as any)
    .select('id, exam_id, order_index, type, question_text, options, correct_answer, marks')
    .eq('exam_id', id)
    .order('order_index', { ascending: true });

  const questions = questionsData as QuestionRow[];
  const answers = (session?.answers ?? {}) as Record<string, unknown>;
  const gradingDetails = (session?.grading_details ?? {}) as Record<string, any>;
  const studentName = profile?.name || invite.student_name || invite.student_email;
  const studentEmail = profile?.email || invite.student_email;

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNavbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href={`/teacher/exam/${id}/monitor`}>
              <Button variant="ghost" size="sm" className="px-0 text-gray-600 hover:text-gray-900">
                Back to Monitor
              </Button>
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">Answer Review</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manual review of each question and the answer submitted by this student
            </p>
          </div>
          <Badge className="bg-indigo-100 text-indigo-800">
            {session?.status ? formatLabel(session.status) : 'No Session'}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-1">
            <h2 className="border-b pb-3 text-sm font-semibold uppercase text-gray-900">Student Info</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{studentName}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Email</p>
                <p className="text-gray-900">{studentEmail}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Submitted</p>
                <p className="text-gray-900">
                  {session?.submitted_at ? new Date(session.submitted_at).toLocaleString() : 'Not submitted'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Score</p>
                <p className="text-gray-900">
                  {session?.score != null && session?.max_score != null ? `${session.score}/${session.max_score}` : '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Manual Answer Review</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Compare each submitted answer against the question and grading details.
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{questions.length}</p>
                <p className="text-xs text-gray-500">Total questions</p>
              </div>
            </div>

            {!session ? (
              <div className="mt-6 rounded bg-gray-50 p-6 text-center text-gray-500">
                No submitted session is available yet for this student.
              </div>
            ) : questions.length === 0 ? (
              <div className="mt-6 rounded bg-gray-50 p-6 text-center text-gray-500">
                No questions were found for this exam.
              </div>
            ) : (
              <form action={saveManualGrades} className="mt-6 space-y-4">
                <input type="hidden" name="exam_id" value={id} />
                <input type="hidden" name="invite_id" value={inviteId} />
                <input type="hidden" name="session_id" value={session.id} />

                {questions.map((question) => {
                  const studentAnswer = answers[question.id];
                  const gradingDetail = gradingDetails[question.id] ?? {};
                  const correctness = isAnswerCorrect(question, studentAnswer);
                  const awardedMarks = typeof gradingDetail.marks_awarded === 'number'
                    ? gradingDetail.marks_awarded
                    : correctness === true
                    ? question.marks
                    : 0;
                  const needsGrading = gradingDetail.needs_grading === true;

                  return (
                    <div key={question.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Question {question.order_index}
                          </p>
                          <p className="mt-1 font-medium text-gray-900">{question.question_text}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-gray-100 text-gray-800">{formatLabel(question.type)}</Badge>
                          <Badge className="bg-indigo-100 text-indigo-800">{question.marks} marks</Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded bg-white p-3">
                          <p className="text-xs uppercase text-gray-500">Student Answer</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">
                            {normalizeAnswer(studentAnswer)}
                          </p>
                        </div>

                        <div className="rounded bg-white p-3">
                          <p className="text-xs uppercase text-gray-500">AI Grading Snapshot</p>
                          <p className="mt-2 text-sm text-gray-900">
                            {needsGrading ? 'Needs manual grading' : correctness === true ? 'Correct' : correctness === false ? 'Incorrect' : 'Not graded'}
                          </p>
                          <p className="mt-2 text-xs text-gray-600">
                            Awarded marks: {typeof gradingDetail.marks_awarded === 'number' ? gradingDetail.marks_awarded : 'Pending manual review'}
                          </p>
                          {question.type === 'mcq' && (
                            <p className="mt-2 text-xs text-gray-600">
                              Correct answer: {question.correct_answer}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded bg-white p-3">
                        <label htmlFor={`marks_${question.id}`} className="text-xs font-semibold uppercase text-gray-500">
                          Manual Marks (0 - {question.marks})
                        </label>
                        <input
                          id={`marks_${question.id}`}
                          name={`marks_${question.id}`}
                          type="number"
                          min={0}
                          max={question.marks}
                          step="0.5"
                          defaultValue={awardedMarks}
                          className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {question.options && question.options.length > 0 && (
                        <div className="mt-4 rounded bg-white p-3">
                          <p className="text-xs uppercase text-gray-500">Options</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {question.options.map((option) => (
                              <div key={option.value} className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                <span className="font-medium text-gray-900">{option.value}.</span> {option.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex items-center justify-between rounded border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <p className="text-sm text-indigo-900">
                    Manual grading updates each question&apos;s awarded marks and recalculates the student score.
                  </p>
                  <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700">
                    Save Manual Marks
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}