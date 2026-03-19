import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { session_id, exam_id, answers } = body

    console.log('submit-exam — session_id:', session_id, 'exam_id:', exam_id)
    console.log('answers received:', JSON.stringify(answers))

    if (!session_id || !exam_id) {
      return Response.json({ error: 'Missing session_id or exam_id' }, { status: 400 })
    }

    const { data: questions, error: questionsError } = await supabase
      .rpc('get_exam_questions', { exam_id_param: exam_id })

    console.log('questions fetched:', questions?.length, 'error:', questionsError)

    if (questionsError) {
      return Response.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    let score = 0
    let max_score = 0
    const grading_details: Record<string, any> = {}

    for (const question of questions ?? []) {
      max_score += question.marks
      const studentAnswer = (answers ?? {})[question.id] ?? null

      console.log(
        `Q ${question.id}: studentAnswer="${studentAnswer}", ` +
        `correct="${question.correct_answer}", type="${question.type}"`
      )

      if (question.type === 'mcq') {
        // MCQ: grade immediately with exact match
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
        // short_answer or long_answer:
        // DO NOT attempt grading here — always defer to /api/grade-answers
        // which uses Gemini for proper semantic grading.
        // Set needs_grading: true so the results page triggers grade-answers.
        grading_details[question.id] = {
          question_text: question.question_text,
          student_answer: studentAnswer,
          correct_answer: question.correct_answer,
          is_correct: false,
          marks_awarded: null,
          needs_grading: true,  // ← triggers Gemini grading on results page
          type: question.type,
        }
      }
    }

    console.log('final score:', score, '/', max_score)
    console.log('grading_details:', JSON.stringify(grading_details))

    const { data: submitData, error: submitError } = await supabase.rpc(
      'submit_exam_session',
      {
        session_id_param: session_id,
        answers_param: answers ?? {},
        score_param: score,
        max_score_param: max_score,
        grading_details_param: grading_details,
      }
    )

    console.log('submitData:', submitData, 'submitError:', submitError)

    if (submitError) {
      console.error('submit RPC error:', submitError)
      return Response.json(
        { error: 'Failed to submit exam', details: submitError },
        { status: 500 }
      )
    }

    return Response.json({ success: true, session_id, score, max_score })
  } catch (err) {
    console.error('submit-exam error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}