import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Validate API key on startup
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment variables!')
} else {
  console.log('✅ GEMINI_API_KEY loaded:', apiKey.substring(0, 10) + '...')
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

async function gradeSubjectiveAnswer({
  questionText,
  studentAnswer,
  correctAnswer,
  maxMarks,
  gradingHint,
  allowSpellingMistakes = false,
}: {
  questionText: string
  studentAnswer: string
  correctAnswer: string
  maxMarks: number
  gradingHint?: string
  allowSpellingMistakes?: boolean
}): Promise<{ marks: number; is_correct: boolean; feedback: string }> {
  if (!genAI) {
    console.error('❌ Gemini AI not initialized. GEMINI_API_KEY is missing.')
    return {
      marks: 0,
      is_correct: false,
      feedback: 'API key not configured. Contact administrator.',
    }
  }

  const prompt = `You are an exam grader. Grade the student's answer strictly and fairly.

Question: ${questionText}
Expected Answer / Key Points: ${correctAnswer}
Student's Answer: ${studentAnswer}
Maximum Marks: ${maxMarks}
${gradingHint ? `Grading Hint: ${gradingHint}` : ''}
${allowSpellingMistakes ? 'Note: Minor spelling mistakes should be ignored.' : 'Note: Spelling is important for this exam.'}

Instructions:
- Award marks from 0 to ${maxMarks} (integers only).
- Be strict: only award full marks if the answer is complete and correct.
- Award partial marks proportionally for partially correct answers.
- A short answer is "correct" if marks awarded >= 50% of max marks.
- The student's answer does not need to match word-for-word — judge based on meaning and correctness.
- Provide 1-2 sentences of feedback explaining the grading.
- Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"marks": <integer>, "is_correct": <boolean>, "feedback": "<brief feedback>"}`

  // Try multiple model names in fallback order
  // Available free-tier models that work with Generative AI API
  const modelNames = ['gemini-2.5-flash', 'gemini-2.5-flash-exp', 'gemini-2.5-pro']
  
  for (const modelName of modelNames) {
    try {
      console.log(`🔍 Attempting Gemini grading with model: ${modelName}`)
      const model = genAI.getGenerativeModel({ model: modelName })
      console.log('✅ Model instantiated successfully')
      
      const result = await model.generateContent(prompt)
      console.log('✅ API response received')
      
      const text = result.response.text().trim()
      console.log(`✅ Gemini (${modelName}) raw response:`, text)

      const cleaned = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      const marks = Math.min(Math.max(Math.round(parsed.marks), 0), maxMarks)
      console.log(`✅ Successfully graded with ${modelName}: ${marks} marks`)
      return {
        marks,
        is_correct: parsed.is_correct === true,
        feedback: parsed.feedback || 'No feedback provided.',
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      const errorStack = err instanceof Error ? err.stack : ''
      console.error(`❌ Model ${modelName} failed:`)
      console.error(`   Error: ${errorMsg}`)
      console.error(`   Stack: ${errorStack}`)
      // Continue to next model
      continue
    }
  }

  // All models failed
  console.error('❌ All Gemini models failed. Possible causes:')
  console.error('  1. Invalid or missing GEMINI_API_KEY')
  console.error('  2. API quota exceeded')
  console.error('  3. Network connectivity issue')
  return {
    marks: 0,
    is_correct: false,
    feedback: 'Grading service temporarily unavailable. Please contact support.',
  }
}

export default async function ResultsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch session
  const { data: sessionData } = await supabase.rpc('get_student_sessions', {
    student_id_param: user.id
  })
  let session = (sessionData ?? []).find((s: any) => s.id === id) ?? null

  if (!session) redirect('/student/home')

  // Auto-grade if needed — WAIT for it to complete before rendering
  const hasUngradedQuestions = Object.values(
    session.grading_details ?? {}
  ).some((d: any) => d.needs_grading === true)

  console.log(`📊 Session ${id}: hasUngradedQuestions = ${hasUngradedQuestions}`)
  console.log('📋 Grading details:', JSON.stringify(session.grading_details ?? {}))

  if (hasUngradedQuestions) {
    console.log(`🚀 Starting auto-grading for session ${id}...`)
    try {
      // Fetch exam questions and settings
      const { data: questions } = await supabase.rpc('get_exam_questions', {
        exam_id_param: session.exam_id
      })

      const { data: examData } = await supabase.rpc('get_exam_by_id', {
        exam_id_param: session.exam_id
      })
      const exam = Array.isArray(examData) ? examData[0] : examData
      const allowSpellingMistakes = exam?.allow_spelling_mistakes ?? false

      const studentAnswers = session.answers || {}
      const existingGradingDetails = session.grading_details || {}
      let totalScore = 0
      let maxScore = 0
      const updatedGradingDetails: Record<string, any> = {}

      // Grade each question
      for (const question of questions ?? []) {
        const qId = question.id
        const studentAnswer = studentAnswers[qId] ?? null
        const maxMarks = question.marks || 1
        maxScore += maxMarks

        if (question.type === 'mcq') {
          // MCQ: already graded in submit-exam, just copy over
          const isCorrect =
            studentAnswer !== null &&
            studentAnswer.trim().toLowerCase() ===
              question.correct_answer?.trim().toLowerCase()
          const marksAwarded = isCorrect ? maxMarks : 0
          totalScore += marksAwarded

          updatedGradingDetails[qId] = {
            question_text: question.question_text,
            student_answer: studentAnswer,
            correct_answer: question.correct_answer,
            is_correct: isCorrect,
            marks_awarded: marksAwarded,
            needs_grading: false,
            type: 'mcq',
          }
        } else {
          // short_answer or long_answer: check if needs grading
          const existing = existingGradingDetails[qId]
          if (existing && !existing.needs_grading && existing.marks_awarded !== null) {
            // Already graded, keep it
            totalScore += existing.marks_awarded
            updatedGradingDetails[qId] = existing
          } else if (!studentAnswer || studentAnswer.trim() === '') {
            // No answer provided
            updatedGradingDetails[qId] = {
              question_text: question.question_text,
              student_answer: studentAnswer,
              correct_answer: question.correct_answer,
              is_correct: false,
              marks_awarded: 0,
              needs_grading: false,
              type: question.type,
              ai_feedback: 'No answer provided.',
            }
          } else {
            // Grade with Gemini
            console.log(`Grading Q ${qId} with Gemini...`)
            const { marks, is_correct, feedback } = await gradeSubjectiveAnswer({
              questionText: question.question_text,
              studentAnswer: studentAnswer,
              correctAnswer: question.correct_answer,
              maxMarks: maxMarks,
              gradingHint: question.grading_hint,
              allowSpellingMistakes,
            })

            totalScore += marks
            updatedGradingDetails[qId] = {
              question_text: question.question_text,
              student_answer: studentAnswer,
              correct_answer: question.correct_answer,
              is_correct,
              marks_awarded: marks,
              needs_grading: false,
              type: question.type,
              ai_feedback: feedback,
            }
          }
        }
      }

      console.log('Server-side grading complete:', { totalScore, maxScore })

      // Save updated grading results
      const { error: submitError } = await supabase.rpc('submit_exam_session', {
        session_id_param: id,
        answers_param: studentAnswers,
        score_param: totalScore,
        max_score_param: maxScore,
        grading_details_param: updatedGradingDetails,
      })

      if (submitError) {
        console.error('Failed to save grading results:', submitError)
      } else {
        // Re-fetch session to get updated data
        const { data: updatedSessionData } = await supabase.rpc(
          'get_student_sessions',
          { student_id_param: user.id }
        )
        const updatedSession = (updatedSessionData ?? []).find(
          (s: any) => s.id === id
        )
        if (updatedSession) session = updatedSession
      }
    } catch (err) {
      console.error('Auto-grading failed:', err)
    }
  }

  // Fetch exam
  const { data: examData } = await supabase.rpc('get_exam_by_id', {
    exam_id_param: session.exam_id
  })
  const exam = examData?.[0] ?? null

  // Fetch questions
  const { data: rawQuestions } = await supabase.rpc('get_exam_questions', {
    exam_id_param: session.exam_id
  })
  const questions = (rawQuestions ?? []).map((q: any) => {
    let options = null
    if (q.options) {
      let parsed = q.options
      if (typeof q.options === 'string') {
        try { parsed = JSON.parse(q.options) } catch { parsed = [] }
      }
      options = Array.isArray(parsed)
        ? parsed.map((o: any) => typeof o === 'object' ? o.value : o)
        : null
    }
    return { ...q, options }
  })

  // Fetch flags via RPC
  const { data: flags } = await supabase.rpc('get_exam_flags', {
    session_id_param: id
  })

  // Score
  const scorePercentage = session.max_score > 0
    ? ((session.score / session.max_score) * 100).toFixed(1)
    : '0'

  const isPassed = exam?.pass_marks
    ? session.score >= exam.pass_marks
    : parseFloat(scorePercentage) >= 50

  const timeTaken = session.started_at && session.submitted_at
    ? Math.round(
        (new Date(session.submitted_at).getTime() -
          new Date(session.started_at).getTime()) / 60000
      )
    : 0

  // Flag type counts
  const flagTypeCounts: Record<string, number> = {}
  for (const flag of (flags ?? []) as any[]) {
    const key = flag.flag_type ?? flag.event_type
    flagTypeCounts[key] = (flagTypeCounts[key] ?? 0) + 1
  }

  const gradingDetails = session.grading_details ?? {}

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
              <div>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Question Review
          </h2>
          <div className="space-y-6">
            {questions.map((question: any, index: number) => {
              // Use grading_details from DB as source of truth
              const detail = gradingDetails[question.id]
              const studentAnswer = detail?.student_answer 
                ?? session.answers?.[question.id] 
                ?? null
              const marksAwarded = detail?.marks_awarded ?? null
              const isCorrect = detail?.is_correct ?? null
              const needsGrading = detail?.needs_grading ?? false
              const aiFeedback = (detail as any)?.ai_feedback ?? null

              return (
                <div
                  key={question.id}
                  className="border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-500 mb-2">
                        Question {index + 1} · {question.marks} marks
                      </p>
                      <p className="text-lg font-medium text-gray-900 mb-4">
                        {question.question_text}
                      </p>

                      {/* Student Answer */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Your Answer:
                        </p>
                        {question.type === 'mcq' ? (
                          <div className="flex items-center">
                            <span className={`text-base ${
                              isCorrect ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {isCorrect ? '✓' : '✗'}
                            </span>
                            <span className="ml-2 text-gray-900">
                              {studentAnswer ?? '(Not answered)'}
                            </span>
                          </div>
                        ) : (
                          <p className="text-gray-900 bg-gray-50 p-3 rounded">
                            {studentAnswer ?? '(Not answered)'}
                          </p>
                        )}
                      </div>

                      {/* Correct Answer */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          Correct Answer:
                        </p>
                        <p className="text-green-700 font-medium">
                          {question.correct_answer}
                        </p>
                      </div>

                      {/* AI Feedback for short/long answers */}
                      {aiFeedback && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-sm font-semibold text-blue-700 mb-1">
                            AI Feedback:
                          </p>
                          <p className="text-sm text-blue-800">{aiFeedback}</p>
                        </div>
                      )}

                      {/* Pending grading notice */}
                      {needsGrading && (
                        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                          <p className="text-sm text-yellow-700">
                            ⏳ This answer is pending manual review.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Marks */}
                    <div className="ml-4 text-center min-w-[60px]">
                      <p className="text-sm text-gray-600">Marks</p>
                      {needsGrading ? (
                        <p className="text-2xl font-bold text-yellow-500">—</p>
                      ) : (
                        <p className={`text-2xl font-bold ${
                          isCorrect ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {marksAwarded ?? 0}/{question.marks}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Behavior & Integrity */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Behavior & Integrity
          </h2>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-gray-600">Total Flags</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {flags?.length ?? 0}
              </p>
            </div>
            <div>
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

          {Object.keys(flagTypeCounts).length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-4">
                Flag Types Detected
              </p>
              <div className="space-y-2">
                {Object.entries(flagTypeCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                  >
                    <span className="text-gray-700 capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No flags detected. Great exam!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}