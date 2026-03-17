import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ResultsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch session
  const sessionDataCall = supabase.rpc('get_student_sessions', {
    student_id_param: user.id
  } as any) as any
  const { data: sessionData } = await sessionDataCall
  const session = (sessionData ?? []).find((s: any) => s.id === id) ?? null

  if (!session) {
    redirect('/student/home')
  }

  // Fetch exam
  const examDataCall = supabase.rpc('get_exam_by_id', {
    exam_id_param: session.exam_id
  } as any) as any
  const { data: examData } = await examDataCall
  const exam = examData?.[0] ?? null

  // Fetch questions
  const questionsDataCall = supabase.rpc('get_exam_questions', {
    exam_id_param: session.exam_id
  } as any) as any
  const { data: rawQuestions } = await questionsDataCall
  const questions = (rawQuestions ?? []).map((q: any) => ({
    ...q,
    options: Array.isArray(q.options)
      ? q.options.map((o: any) =>
          typeof o === 'object' ? o.value : o
        )
      : null
  }))

  // Fetch behavior logs
  const { data: flags } = await supabase
    .from('behavior_logs')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: false })

  // Calculate score percentage
  const scorePercentage = session.max_score > 0 
    ? ((session.score / session.max_score) * 100).toFixed(1)
    : 0

  // Determine pass/fail
  const isPassed = session.score >= (exam?.pass_marks ?? 0)

  // Calculate time taken in minutes
  const timeTaken = session.started_at && session.submitted_at
    ? Math.round((new Date(session.submitted_at).getTime() - new Date(session.started_at).getTime()) / 60000)
    : 0

  // Count flag types
  const flagTypeCounts: Record<string, number> = {}
  for (const flag of (flags ?? []) as any[]) {
    flagTypeCounts[flag.event_type] = (flagTypeCounts[flag.event_type] ?? 0) + 1
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Exam Results</h1>
              <p className="text-gray-600 mt-1">{exam?.title}</p>
            </div>
            <a
              href="/student/home"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Score Card */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-5xl font-bold text-blue-600">
                {session.score}/{session.max_score}
              </div>
              <p className="text-gray-600 mt-2">Score</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-gray-800">
                {scorePercentage}%
              </div>
              <p className="text-gray-600 mt-2">Percentage</p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Status</p>
                <div className="mt-2">
                  <span className={`inline-block px-4 py-2 rounded-full font-semibold ${
                    isPassed
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {isPassed ? '✓ Passed' : '✗ Failed'}
                  </span>
                </div>
              </div>
              <div suppressHydrationWarning>
                <p className="text-gray-600">Time Taken</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {timeTaken} minutes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Question Review */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Question Review</h2>
          <div className="space-y-6">
            {questions.map((question: any, index: number) => {
              const studentAnswer = session.answers?.[question.id]
              const isCorrect = question.type === 'mcq'
                ? studentAnswer?.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim()
                : null

              return (
                <div key={question.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-500 mb-2">
                        Question {index + 1} · {question.marks} marks
                      </p>
                      <p className="text-lg font-medium text-gray-900 mb-4">
                        {question.question_text}
                      </p>

                      {question.type === 'mcq' && question.options && (
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            Your Answer:
                          </p>
                          <div className="flex items-center">
                            <span className={`text-base ${
                              isCorrect ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isCorrect ? '✓' : '✗'}
                            </span>
                            <span className="ml-2 text-gray-900">
                              {studentAnswer || '(Not answered)'}
                            </span>
                          </div>
                        </div>
                      )}

                      {(question.type === 'short_answer' || question.type === 'long_answer') && (
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">
                            Your Answer:
                          </p>
                          <p className="text-gray-900 bg-gray-50 p-3 rounded">
                            {studentAnswer || '(Not answered)'}
                          </p>
                        </div>
                      )}

                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Correct Answer:
                        </p>
                        <p className="text-green-700 font-medium">
                          {question.correct_answer}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Marks</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {isCorrect === false ? '0' : isCorrect === true ? question.marks : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Behavior Summary */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Behavior & Integrity</h2>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-gray-600">Total Flags</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {flags?.length ?? 0}
              </p>
            </div>
            <div suppressHydrationWarning>
              <p className="text-gray-600">Cheating Risk Score</p>
              <p className={`text-3xl font-bold mt-2 ${
                (session.cheating_score ?? 0) > 0.7
                  ? 'text-red-600'
                  : (session.cheating_score ?? 0) > 0.4
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}>
                {((session.cheating_score ?? 0) * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {Object.keys(flagTypeCounts).length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Flag Types Detected
              </p>
              <div className="space-y-2">
                {Object.entries(flagTypeCounts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                    <span className="text-gray-700 capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!flags || flags.length === 0) && (
            <div className="text-center py-8">
              <p className="text-gray-500">No flags detected. Great exam!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
