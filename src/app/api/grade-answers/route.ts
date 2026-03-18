import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface GradingDetail {
  question_text: string;
  student_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  marks_awarded: number | null;
  needs_grading: boolean;
  type: string;
}

interface GradingDetails {
  [question_id: string]: GradingDetail;
}

interface GradeSubjectiveParams {
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  maxMarks: number;
  gradingHint?: string;
  allowSpellingMistakes?: boolean;
}

async function gradeSubjectiveAnswer({
  questionText,
  studentAnswer,
  correctAnswer,
  maxMarks,
  gradingHint,
  allowSpellingMistakes = false,
}: GradeSubjectiveParams): Promise<{ marks: number; is_correct: boolean }> {
  // Try multiple model names in fallback order
  // Available free-tier models that work with Generative AI API
  const modelNames = ['gemini-2.5-flash', 'gemini-2.5-flash-exp', 'gemini-2.5-pro']

  const prompt = `You are an exam grader. Grade the student's answer strictly and fairly.

Question: ${questionText}
Expected Answer / Key Points: ${correctAnswer}
Student's Answer: ${studentAnswer}
Maximum Marks: ${maxMarks}
${gradingHint ? `Grading Hint: ${gradingHint}` : ""}
${allowSpellingMistakes ? "Note: Minor spelling mistakes should be ignored." : "Note: Spelling is important for this exam."}

Instructions:
- Award marks from 0 to ${maxMarks} (integers only).
- Be strict: only award full marks if the answer is complete and correct.
- Award partial marks proportionally for partially correct answers.
- A short answer is "correct" if marks awarded >= 50% of max marks.
- The student's answer does not need to match word-for-word — judge based on meaning and correctness.
- Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"marks": <integer>, "is_correct": <boolean>}`

  for (const modelName of modelNames) {
    try {
      console.log(`Attempting Gemini grading with model: ${modelName}`)
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()

      console.log(`Gemini (${modelName}) raw response:`, text)

      const cleaned = text.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(cleaned)
      const marks = Math.min(Math.max(Math.round(parsed.marks), 0), maxMarks)
      return { marks, is_correct: parsed.is_correct === true }
    } catch (err) {
      console.error(`Model ${modelName} failed:`, err instanceof Error ? err.message : String(err))
      // Continue to next model
      continue
    }
  }

  // All models failed
  console.error('All Gemini model attempts failed. Check GEMINI_API_KEY and model availability.')
  return { marks: 0, is_correct: false }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { session_id } = body;

    console.log('grade-answers — session_id:', session_id, 'user:', user.id);

    if (!session_id) {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400 }
      );
    }

    // Fetch session using get_student_sessions
    const { data: allSessions, error: sessionError } = await supabase.rpc(
      'get_student_sessions',
      { student_id_param: user.id }
    );

    console.log('allSessions count:', allSessions?.length, 'error:', sessionError);

    if (sessionError) {
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    const session = (allSessions ?? []).find((s: any) => s.id === session_id);

    console.log('found session:', session?.id ?? 'NOT FOUND');

    if (!session) {
      return NextResponse.json(
        { error: "Session not found or access denied" },
        { status: 404 }
      );
    }

    // Fetch exam questions
    const { data: questions, error: questionsError } = await supabase.rpc(
      "get_exam_questions",
      { exam_id_param: session.exam_id }
    );

    console.log('questions fetched:', questions?.length, 'error:', questionsError);

    if (questionsError || !questions) {
      return NextResponse.json(
        { error: "Failed to fetch questions" },
        { status: 500 }
      );
    }

    // Fetch exam settings for allow_spelling_mistakes
    const { data: examData, error: examError } = await supabase.rpc(
      "get_exam_by_id",
      { exam_id_param: session.exam_id }
    );

    const exam = Array.isArray(examData) ? examData[0] : examData;
    const allowSpellingMistakes = exam?.allow_spelling_mistakes ?? false;

    console.log('allowSpellingMistakes:', allowSpellingMistakes);

    const studentAnswers: Record<string, string> = session.answers || {};
    const existingGradingDetails: GradingDetails = session.grading_details || {};

    let totalScore = 0;
    let maxScore = 0;
    const updatedGradingDetails: GradingDetails = {};

    for (const question of questions) {
      const qId = question.id;
      const studentAnswer = studentAnswers[qId] ?? null;
      const maxMarks = question.marks || 1;
      maxScore += maxMarks;

      console.log(`Processing Q ${qId} type=${question.type} answer="${studentAnswer}" correct="${question.correct_answer}"`);

      if (question.type === "mcq") {
        const isCorrect =
          studentAnswer !== null &&
          studentAnswer.trim().toLowerCase() ===
            question.correct_answer?.trim().toLowerCase();

        const marksAwarded = isCorrect ? maxMarks : 0;
        totalScore += marksAwarded;

        updatedGradingDetails[qId] = {
          question_text: question.question_text,
          student_answer: studentAnswer,
          correct_answer: question.correct_answer,
          is_correct: isCorrect,
          marks_awarded: marksAwarded,
          needs_grading: false,
          type: "mcq",
        };
      } else {
        // short_answer or long_answer
        if (!studentAnswer || studentAnswer.trim() === "") {
          totalScore += 0;
          updatedGradingDetails[qId] = {
            question_text: question.question_text,
            student_answer: studentAnswer,
            correct_answer: question.correct_answer,
            is_correct: false,
            marks_awarded: 0,
            needs_grading: false,
            type: question.type,
          };
        } else {
          // Check if already graded
          const existing = existingGradingDetails[qId];
          if (
            existing &&
            !existing.needs_grading &&
            existing.marks_awarded !== null
          ) {
            console.log(`Q ${qId} already graded, skipping`);
            totalScore += existing.marks_awarded;
            updatedGradingDetails[qId] = existing;
          } else {
            // Grade with Gemini
            console.log(`Sending Q ${qId} to Gemini...`);
            const { marks, is_correct } = await gradeSubjectiveAnswer({
              questionText: question.question_text,
              studentAnswer: studentAnswer,
              correctAnswer: question.correct_answer,
              maxMarks: maxMarks,
              gradingHint: question.grading_hint,
              allowSpellingMistakes,
            });

            console.log(`Gemini result for Q ${qId}: marks=${marks} is_correct=${is_correct}`);

            totalScore += marks;
            updatedGradingDetails[qId] = {
              question_text: question.question_text,
              student_answer: studentAnswer,
              correct_answer: question.correct_answer,
              is_correct,
              marks_awarded: marks,
              needs_grading: false,
              type: question.type,
            };
          }
        }
      }
    }

    console.log('final totalScore:', totalScore, '/', maxScore);
    console.log('updatedGradingDetails:', JSON.stringify(updatedGradingDetails));

    // Save results
    const { error: submitError } = await supabase.rpc("submit_exam_session", {
      session_id_param: session_id,
      answers_param: studentAnswers,
      score_param: totalScore,
      max_score_param: maxScore,
      grading_details_param: updatedGradingDetails,
    });

    console.log('submitError:', submitError);

    if (submitError) {
      return NextResponse.json(
        { error: "Failed to save grading results" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      score: totalScore,
      max_score: maxScore,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      grading_details: updatedGradingDetails,
    });
  } catch (err) {
    console.error("grade-answers error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}