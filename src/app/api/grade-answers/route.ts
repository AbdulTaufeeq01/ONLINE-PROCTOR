import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectAIWrittenContent } from '@/lib/ai-detection'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface GradingDetail {
  question_text: string
  student_answer: string | null
  correct_answer: string
  is_correct: boolean
  marks_awarded: number | null
  needs_grading: boolean
  type: string
  ai_feedback?: string
}

interface GradingDetails {
  [question_id: string]: GradingDetail
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ')
}

async function gradeSubjectiveAnswer({
  questionText,
  studentAnswer,
  correctAnswer,
  maxMarks,
  questionType,
  gradingHint,
  allowSpellingMistakes = false,
}: {
  questionText: string
  studentAnswer: string
  correctAnswer: string
  maxMarks: number
  questionType: string
  gradingHint?: string
  allowSpellingMistakes?: boolean
}): Promise<{ marks: number; is_correct: boolean; ai_feedback: string }> {
  // Fast path 1: exact normalized match
  if (normalize(studentAnswer) === normalize(correctAnswer)) {
    return {
      marks: maxMarks,
      is_correct: true,
      ai_feedback: 'Exact match — full marks awarded.',
    }
  }

  // Fast path 2: correct answer is short (≤ 10 chars) and student answer contains it.
  // Handles cases like correct="2x", student="the derivative is 2x because the power rule..."
  // We award full marks without calling Gemini to avoid unnecessary API calls.
  const normStudent = normalize(studentAnswer)
  const normCorrect = normalize(correctAnswer)
  if (normCorrect.length <= 10 && normStudent.includes(normCorrect)) {
    return {
      marks: maxMarks,
      is_correct: true,
      ai_feedback: 'Correct — answer contains the expected value.',
    }
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const isLongAnswer = questionType === 'long_answer'

  const prompt = `You are a fair and experienced exam grader. Grade the following student answer.

QUESTION: ${questionText}
CORRECT ANSWER: ${correctAnswer}
STUDENT ANSWER: ${studentAnswer}
MAXIMUM MARKS: ${maxMarks}
QUESTION TYPE: ${questionType}
ALLOW SPELLING MISTAKES: ${allowSpellingMistakes}
${gradingHint ? `GRADING HINT: ${gradingHint}` : ''}

GRADING RULES:
1. Compare meaning, not exact wording. Different phrasing of the same idea = full marks.
2. Abbreviations equal their full forms: "ANN" = "artificial neural network",
   "AI" = "artificial intelligence", "UK" = "United Kingdom", "WW2" = "World War 2".
3. If the student writes the full form and the correct answer has the abbreviation
   (or vice versa), award full marks.
4. ${allowSpellingMistakes
    ? 'Spelling mistakes are allowed — ignore ALL spelling errors completely.'
    : 'Minor typos are acceptable.'}
5. Extra filler words like "the full form is", "it is", "its", "I think" do NOT
   reduce marks. Example: if the correct answer is "berlin" and the student writes
   "the capital of germany is berlin" — that is CORRECT.
6. Missing key facts or clearly wrong information = reduced or zero marks.
${isLongAnswer
  ? '7. For long answers, award partial marks proportionally. If the student covers the main concept correctly, award at least 50% marks.'
  : '7. For short answers, award full marks if the core answer is correct regardless of phrasing. Only award 0 if the answer is completely wrong or missing.'}

IMPORTANT: Respond with valid JSON only. No markdown, no backticks, no text outside the JSON object.
{
  "is_correct": true,
  "marks_awarded": ${maxMarks},
  "ai_feedback": "One or two sentences explaining the mark given."
}`

  // Retry up to 2 times on 429 quota errors, waiting the suggested delay
  const MAX_RETRIES = 2
  let lastErr: any = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()
    console.log('[Gemini] Raw response:', rawText)

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    console.log('[Gemini] Parsed:', JSON.stringify(parsed))

    const rawMarks = parsed.marks_awarded ?? parsed.marks ?? 0
    const geminiIsCorrect = parsed.is_correct === true

    let finalMarks: number
    if (geminiIsCorrect && Number(rawMarks) === 0) {
      finalMarks = maxMarks
    } else {
      finalMarks = Math.min(Math.max(Math.round(Number(rawMarks)), 0), maxMarks)
    }

    const aiFeedback: string =
      parsed.ai_feedback ||
      parsed.feedback ||
      parsed.explanation ||
      parsed.reason ||
      (geminiIsCorrect ? 'Answer is correct.' : 'Answer is incorrect.')

      return { marks: finalMarks, is_correct: geminiIsCorrect, ai_feedback: aiFeedback }
    } catch (err: any) {
      lastErr = err
      const status = err?.status ?? err?.statusCode ?? 0
      if (status === 429 && attempt < MAX_RETRIES) {
        // Extract retry delay from error message, default to 15s
        const retryMatch = err?.message?.match(/Please retry in ([\d.]+)s/)
        const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) * 1000 + 500 : 15000
        console.warn(`[Gemini] 429 quota hit — waiting ${waitMs}ms before retry ${attempt + 1}/${MAX_RETRIES}`)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      // Non-429 error or out of retries — break to fallback
      break
    }
  }

  // All retries exhausted — run keyword fallback
  {
    const err: any = lastErr
    const errMsg = err?.message ?? err?.status ?? JSON.stringify(err, Object.getOwnPropertyNames(err))
    console.error('[Gemini] Failed — model: gemini-2.5-flash | error:', errMsg)

    // Fallback: keyword matching
    // Uses length > 1 (not > 2) so short correct answers like "2x" are not dropped.
    // Also checks if the student answer simply CONTAINS the full correct answer —
    // this handles cases like correct="2x", student="the answer is 2x because..."
    const studentNorm = normalize(studentAnswer)
    const correctNorm = normalize(correctAnswer)

    // Direct contains: student answer includes the whole correct answer string
    const directContains = studentNorm.includes(correctNorm)

    // Keyword match: every meaningful word in the correct answer found in student answer
    const correctWords = correctNorm.split(' ').filter((w) => w.length > 1)
    const matchCount = correctWords.filter((w) => studentNorm.includes(w)).length
    // If correctWords is empty (correct answer is a single character), use directContains
    const matchRatio = correctWords.length > 0
      ? matchCount / correctWords.length
      : (directContains ? 1 : 0)

    const isCorrect = directContains || matchRatio >= 0.6
    const fallbackMarks = isCorrect
      ? maxMarks
      : matchRatio >= 0.3
      ? Math.round(maxMarks * 0.5)
      : 0

    return {
      marks: fallbackMarks,
      is_correct: isCorrect,
      ai_feedback: isCorrect
        ? 'Answer accepted based on keyword matching (AI temporarily unavailable).'
        : matchRatio >= 0.3
        ? 'Partial credit awarded — some key concepts present (AI temporarily unavailable).'
        : 'Answer does not match expected response (AI temporarily unavailable).',
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, user_id, answers: bodyAnswers, cheating_score } = body

    console.log('[grade-answers] session_id:', session_id, 'user_id:', user_id)

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    // Fetch session — verify ownership if user_id provided
    let sessionQuery = supabaseAdmin
      .from('exam_sessions')
      .select('id, exam_id, student_id, status, answers, score, max_score, grading_details')
      .eq('id', session_id)

    if (user_id) {
      sessionQuery = sessionQuery.eq('student_id', user_id)
    }

    const { data: session, error: sessionError } = await sessionQuery.single()

    console.log('[grade-answers] session status:', session?.status, 'error:', sessionError)

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    // Use answers from request body if provided (latest client state),
    // otherwise fall back to what was last auto-saved in the DB.
    // This is critical: if the student answered questions after the last
    // auto-save, body answers will be more up-to-date than session.answers.
    const studentAnswers: Record<string, string> =
      bodyAnswers && Object.keys(bodyAnswers).length > 0
        ? bodyAnswers
        : (session.answers ?? {})

    console.log('[grade-answers] answer source:', bodyAnswers ? 'request body' : 'database')

    // Fetch questions
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('questions')
      .select('id, type, question_text, options, correct_answer, marks, grading_hint')
      .eq('exam_id', session.exam_id)
      .order('order_index', { ascending: true })

    console.log('[grade-answers] questions:', questions?.length, 'error:', questionsError)

    if (questionsError || !questions) {
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    // Fetch exam settings
    const { data: exam } = await supabaseAdmin
      .from('exams')
      .select('allow_spelling_mistakes')
      .eq('id', session.exam_id)
      .single()

    const allowSpellingMistakes = exam?.allow_spelling_mistakes ?? false

    let totalScore = 0
    let maxScore = 0
    const updatedGradingDetails: GradingDetails = {}

    for (const question of questions) {
      const qId = question.id
      const studentAnswer = studentAnswers[qId] ?? null
      const maxMarks = question.marks || 1
      maxScore += maxMarks

      console.log(
        `[grade-answers] Q ${qId} type=${question.type} answer="${studentAnswer}" correct="${question.correct_answer}"`
      )

      if (question.type === 'mcq') {
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
          ai_feedback: isCorrect
            ? 'Correct answer selected.'
            : 'Incorrect answer selected.',
        }
      } else {
        // short_answer and long_answer — grade with Gemini
        if (!studentAnswer || studentAnswer.trim() === '') {
          updatedGradingDetails[qId] = {
            question_text: question.question_text,
            student_answer: studentAnswer,
            correct_answer: question.correct_answer,
            is_correct: false,
            marks_awarded: 0,
            needs_grading: false,
            type: question.type,
            ai_feedback: 'No answer was provided.',
          }
        } else {
          console.log(`[grade-answers] Sending Q ${qId} (${question.type}) to Gemini...`)

          const { marks, is_correct, ai_feedback } = await gradeSubjectiveAnswer({
            questionText: question.question_text,
            studentAnswer: studentAnswer.trim(),
            correctAnswer: question.correct_answer,
            maxMarks,
            questionType: question.type,
            gradingHint: question.grading_hint,
            allowSpellingMistakes,
          })

          console.log(
            `[grade-answers] Q ${qId}: marks=${marks}/${maxMarks} is_correct=${is_correct}`
          )

          totalScore += marks
          updatedGradingDetails[qId] = {
            question_text: question.question_text,
            student_answer: studentAnswer,
            correct_answer: question.correct_answer,
            is_correct,
            marks_awarded: marks,
            needs_grading: false,
            type: question.type,
            ai_feedback,
          }
        }
      }
    }

    console.log('[grade-answers] totalScore:', totalScore, '/', maxScore)

    // Save results via RPC (session must still be in_progress at this point
    // because ExamTaker now calls this route directly instead of submit-exam first)
    const { error: submitError } = await supabaseAdmin.rpc('submit_exam_session', {
      p_session_id:            session_id,
      p_score_param:           totalScore,
      p_max_score_param:       maxScore,
      p_status_param:          'submitted',
      p_answers_param:         studentAnswers,
      p_grading_details_param: updatedGradingDetails,
      p_submitted_at:          new Date().toISOString(),
    })

    if (submitError) {
      console.error('[grade-answers] submit_exam_session error:', submitError)

      // RPC failed (e.g. session was already submitted by a duplicate call).
      // Fall back to a direct update so grading results are never lost.
      console.log('[grade-answers] Falling back to direct update...')
      const { error: directError } = await supabaseAdmin
        .from('exam_sessions')
        .update({
          score:            totalScore,
          max_score:        maxScore,
          status:           'submitted',
          answers:          studentAnswers,
          grading_details:  updatedGradingDetails,
          submitted_at:     new Date().toISOString(),
        })
        .eq('id', session_id)

      if (directError) {
        console.error('[grade-answers] direct update also failed:', directError)
        return NextResponse.json(
          { error: 'Failed to save grading results', details: directError },
          { status: 500 }
        )
      }
    }

    // Save cheating score if provided (non-fatal)
    if (cheating_score != null) {
      const { error: cheatingError } = await supabaseAdmin
        .from('exam_sessions')
        .update({ cheating_score })
        .eq('id', session_id)

      if (cheatingError) {
        console.error('[grade-answers] cheating_score update failed:', cheatingError)
      }
    }

    // ── Trigger server-side behavioral analysis (non-blocking) ────────────────
    // Runs after submission so it never delays the student's redirect.
    // analyze-behavior reads flags + behavior_logs + runs AI writing detection
    // and saves the final cheating_score + ai_report back to the session.
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${baseUrl}/api/analyze-behavior`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id }),
      }).catch((err) => console.error('[grade-answers] analyze-behavior fire-and-forget failed:', err))
    } catch (_) {}

    return NextResponse.json({
      success: true,
      score: totalScore,
      max_score: maxScore,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      grading_details: updatedGradingDetails,
    })
  } catch (err) {
    console.error('[grade-answers] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}