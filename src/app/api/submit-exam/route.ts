import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { session_id, exam_id, answers, cheating_score } = body

    console.log('submit-exam — session_id:', session_id, 'exam_id:', exam_id)
    console.log('answers received:', JSON.stringify(answers))

    if (!session_id || !exam_id) {
      return Response.json({ error: 'Missing session_id or exam_id' }, { status: 400 })
    }

    // ── Fetch questions ───────────────────────────────────────────────────────
    const { data: questions, error: questionsError } = await (supabase.rpc as any)(
      'get_exam_questions',
      { p_exam_id: exam_id }
    )

    console.log('questions fetched:', questions?.length, 'error:', questionsError)

    if (questionsError) {
      console.error('get_exam_questions error:', questionsError)
      return Response.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    if (!questions || questions.length === 0) {
      console.error('No questions returned for exam:', exam_id)
      return Response.json({ error: 'No questions found for this exam' }, { status: 500 })
    }

    // ── Grade answers ─────────────────────────────────────────────────────────
    let score = 0
    let max_score = 0
    const grading_details: Record<string, any> = {}

    for (const question of questions) {
      max_score += question.marks
      const studentAnswer = (answers ?? {})[question.id] ?? null

      console.log(
        `Q ${question.id}: studentAnswer="${studentAnswer}", ` +
        `correct="${question.correct_answer}", type="${question.type}"`
      )

      if (question.type === 'mcq') {
        const isCorrect =
          studentAnswer != null &&
          studentAnswer.toLowerCase().trim() ===
            question.correct_answer?.toLowerCase().trim()

        if (isCorrect) score += question.marks

        grading_details[question.id] = {
          question_text: question.question_text,
          student_answer: studentAnswer,
          correct_answer: question.correct_answer,
          is_correct: isCorrect,
          marks_awarded: isCorrect ? question.marks : 0,
          needs_grading: false,
          type: question.type,
        }
      } else {
        // Defer short/long answer to Gemini via /api/grade-answers
        grading_details[question.id] = {
          question_text: question.question_text,
          student_answer: studentAnswer,
          correct_answer: question.correct_answer,
          is_correct: false,
          marks_awarded: null,
          needs_grading: true,
          type: question.type,
        }
      }
    }

    console.log('final score:', score, '/', max_score)

    // ── Submit session — exact param names from Supabase function definition ──
    // NOTE: mixed naming in the actual DB function:
    //   p_session_id              (no _param suffix)
    //   p_score_param             (has _param suffix)
    //   p_max_score_param         (has _param suffix)
    //   p_status_param            (has _param suffix)
    //   p_answers_param           (has _param suffix)
    //   p_grading_details_param   (has _param suffix)
    //   p_submitted_at            (no _param suffix)
    const { data: submitData, error: submitError } = await (supabase.rpc as any)(
      'submit_exam_session',
      {
        p_session_id:            session_id,
        p_score_param:           score,
        p_max_score_param:       max_score,
        p_status_param:          'submitted',
        p_answers_param:         answers ?? {},
        p_grading_details_param: grading_details,
        p_submitted_at:          new Date().toISOString(),
      }
    )

    console.log('submitData:', submitData, 'submitError:', submitError)

    if (submitError) {
      console.error('submit_exam_session RPC error:', submitError)
      return Response.json(
        { error: 'Failed to submit exam', details: submitError },
        { status: 500 }
      )
    }

    // ── Update cheating score (non-fatal) ─────────────────────────────────────
    if (cheating_score != null) {
      const { error: cheatingError } = await (supabase.from('exam_sessions') as any)
        .update({ cheating_score })
        .eq('id', session_id)

      if (cheatingError) {
        console.error('Failed to update cheating_score:', cheatingError)
      }
    }

    return Response.json({ success: true, session_id, score, max_score })
  } catch (err) {
    console.error('submit-exam error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}