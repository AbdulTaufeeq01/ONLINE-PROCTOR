import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { compareAnswers } from '@/lib/semantic-similarity';

interface SessionAnswers {
  session_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  answers: Record<string, string>;
  submitted_at: string | null;
}

interface Question {
  id: string;
  type: string;
  question_text: string;
}

interface CollusionPair {
  student_a_id: string;
  student_a_name: string;
  student_b_id: string;
  student_b_name: string;
  question_id: string;
  question_text: string;
  similarity_percent: number; // 0-100
  verdict: string;
  explanation: string;
}

interface CollusionResult {
  exam_id: string;
  total_pairs_checked: number;
  flagged_pairs: CollusionPair[];
  summary: string;
}

function getFlagSeverity(verdict: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (verdict) {
    case 'likely_copied':
      return 'critical';
    case 'highly_similar':
      return 'high';
    case 'similar':
      return 'medium';
    default:
      return 'low';
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { exam_id, question_id } = body;

    if (!exam_id) {
      return NextResponse.json(
        { error: 'exam_id is required' },
        { status: 400 }
      );
    }

    // Verify teacher owns this exam
    const { data: examData, error: examError } = await (supabase.rpc as any)(
      'get_teacher_exam',
      { exam_id_param: exam_id, teacher_id_param: user.id }
    );

    if (examError || !examData) {
      return NextResponse.json(
        { error: 'Exam not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch all submitted sessions for this exam
    const { data: sessionsRaw, error: sessionsError } = await (supabase.rpc as any)(
      'get_exam_sessions_for_collusion',
      { exam_id_param: exam_id }
    );

    if (sessionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    const sessions: SessionAnswers[] = (sessionsRaw ?? []).filter(
      (s: SessionAnswers) => s.answers && Object.keys(s.answers).length > 0
    );

    if (sessions.length < 2) {
      return NextResponse.json<CollusionResult>({
        exam_id,
        total_pairs_checked: 0,
        flagged_pairs: [],
        summary: 'Not enough submissions to analyze collusion.',
      });
    }

    // Fetch all questions
    const { data: questionsRaw, error: questionsError } = await (supabase.rpc as any)(
      'get_exam_questions',
      { exam_id_param: exam_id }
    );

    if (questionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    const allQuestions: Question[] = questionsRaw ?? [];

    // Filter to only short_answer and long_answer questions (not MCQ)
    const questionsToCheck = question_id
      ? allQuestions.filter(
          (q) => q.id === question_id && (q.type === 'short_answer' || q.type === 'long_answer')
        )
      : allQuestions.filter((q) => q.type === 'short_answer' || q.type === 'long_answer');

    if (questionsToCheck.length === 0) {
      return NextResponse.json<CollusionResult>({
        exam_id,
        total_pairs_checked: 0,
        flagged_pairs: [],
        summary: 'No subjective questions found to check for collusion.',
      });
    }

    const flaggedPairs: CollusionPair[] = [];
    let totalPairsChecked = 0;

    // For each question, compare every pair of students' answers
    for (const question of questionsToCheck) {
      // Get student answers for this question
      const answersByStudent = sessions
        .map((session) => ({
          session_id: session.session_id,
          student_id: session.student_id,
          student_name: session.student_name,
          student_email: session.student_email,
          answer: (session.answers[question.id] || '').trim(),
        }))
        .filter((item) => item.answer.length > 0);

      if (answersByStudent.length < 2) continue;

      // Compare every pair of answers for this question
      for (let i = 0; i < answersByStudent.length; i++) {
        for (let j = i + 1; j < answersByStudent.length; j++) {
          const studentA = answersByStudent[i];
          const studentB = answersByStudent[j];

          totalPairsChecked++;

          try {
            const result = await compareAnswers(studentA.answer, studentB.answer);

            // Flag if similarity is high or very high
            if (result.verdict === 'highly_similar' || result.verdict === 'likely_copied') {
              flaggedPairs.push({
                student_a_id: studentA.student_id,
                student_a_name: studentA.student_name,
                student_b_id: studentB.student_id,
                student_b_name: studentB.student_name,
                question_id: question.id,
                question_text: question.question_text,
                similarity_percent: result.similarity_percent,
                verdict: result.verdict,
                explanation: result.explanation,
              });

              // Create flag in database for student A
              const severity = getFlagSeverity(result.verdict);
              await (supabase.rpc as any)('insert_flag', {
                session_id_param: studentA.session_id,
                student_id_param: studentA.student_id,
                exam_id_param: exam_id,
                flag_type_param: 'collusion_detected',
                severity_param: severity,
                metadata_param: {
                  student_b_session_id: studentB.session_id,
                  student_b_name: studentB.student_name,
                  student_b_email: studentB.student_email,
                  question_id: question.id,
                  question_text: question.question_text,
                  similarity_percent: result.similarity_percent,
                  verdict: result.verdict,
                  explanation: result.explanation,
                },
              });

              // Create flag in database for student B
              await (supabase.rpc as any)('insert_flag', {
                session_id_param: studentB.session_id,
                student_id_param: studentB.student_id,
                exam_id_param: exam_id,
                flag_type_param: 'collusion_detected',
                severity_param: severity,
                metadata_param: {
                  student_b_session_id: studentA.session_id,
                  student_b_name: studentA.student_name,
                  student_b_email: studentA.student_email,
                  question_id: question.id,
                  question_text: question.question_text,
                  similarity_percent: result.similarity_percent,
                  verdict: result.verdict,
                  explanation: result.explanation,
                },
              });
            }
          } catch (error) {
            console.error(
              `Error comparing answers for question ${question.id}:`,
              error
            );
            // Continue with next pair
          }
        }
      }
    }

    // Sort by similarity descending
    flaggedPairs.sort((a, b) => b.similarity_percent - a.similarity_percent);

    const criticalCount = flaggedPairs.filter(
      (p) => p.verdict === 'likely_copied'
    ).length;
    const highCount = flaggedPairs.filter((p) => p.verdict === 'highly_similar').length;

    let summary = `Analyzed ${totalPairsChecked} answer pairs across ${questionsToCheck.length} question(s). `;
    if (flaggedPairs.length === 0) {
      summary += 'No suspicious similarity detected.';
    } else {
      summary += `Found ${flaggedPairs.length} highly similar pair(s): ${criticalCount} likely copied, ${highCount} highly similar.`;
      if (criticalCount > 0) {
        summary += ' Manual review strongly recommended.';
      }
    }

    return NextResponse.json<CollusionResult>({
      exam_id,
      total_pairs_checked: totalPairsChecked,
      flagged_pairs: flaggedPairs,
      summary,
    });
  } catch (err) {
    console.error('detect-collusion error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}