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
  ai_feedback?: string;
}

interface GradingDetails {
  [question_id: string]: GradingDetail;
}

interface GradeSubjectiveParams {
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  maxMarks: number;
  questionType: string;
  gradingHint?: string;
  allowSpellingMistakes?: boolean;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

async function gradeSubjectiveAnswer({
  questionText,
  studentAnswer,
  correctAnswer,
  maxMarks,
  questionType,
  gradingHint,
  allowSpellingMistakes = false,
}: GradeSubjectiveParams): Promise<{
  marks: number;
  is_correct: boolean;
  ai_feedback: string;
}> {
  // Fast path: exact normalized match always gets full marks
  if (normalize(studentAnswer) === normalize(correctAnswer)) {
    return {
      marks: maxMarks,
      is_correct: true,
      ai_feedback: "Exact match — full marks awarded.",
    };
  }

  // Use gemini-2.5-flash (stable, confirmed available)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const isLongAnswer = questionType === "long_answer";

  const prompt = `You are a fair and experienced exam grader. Grade the following student answer.

QUESTION: ${questionText}
CORRECT ANSWER: ${correctAnswer}
STUDENT ANSWER: ${studentAnswer}
MAXIMUM MARKS: ${maxMarks}
QUESTION TYPE: ${questionType}
ALLOW SPELLING MISTAKES: ${allowSpellingMistakes}
${gradingHint ? `GRADING HINT: ${gradingHint}` : ""}

GRADING RULES:
1. Compare meaning, not exact wording. Different phrasing of the same idea = full marks.
2. Abbreviations equal their full forms: "ANN" = "artificial neural network", "AI" = "artificial intelligence", "UK" = "United Kingdom", "WW2" = "World War 2" = "World War II", etc.
3. If the student writes the full form and the correct answer has the abbreviation (or vice versa), award full marks.
4. ${allowSpellingMistakes ? "Spelling mistakes are allowed — ignore ALL spelling errors completely." : "Minor typos are acceptable."}
5. Extra filler words like 'the full form is', 'it is', 'its', 'I think' do NOT reduce marks.
6. Missing key facts or clearly wrong information = reduced or zero marks.
${isLongAnswer
    ? `7. For long answers, award partial marks proportionally. If the student covers the main concept correctly, award at least 50% marks. Award full marks if all key points are present even if less detailed than the model answer.`
    : `7. For short answers, award full marks if the core answer is correct regardless of phrasing. Only award 0 if the answer is completely wrong or missing.`
  }

IMPORTANT: Respond with valid JSON only. No markdown, no backticks, no text outside the JSON object.

Your response must be exactly this shape:
{
  "is_correct": true,
  "marks_awarded": ${maxMarks},
  "ai_feedback": "One or two sentences explaining the mark given."
}`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    console.log(`[Gemini] Raw response:`, rawText);

    // Strip markdown fences if Gemini adds them
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    console.log('[Gemini] Parsed:', JSON.stringify(parsed));

    // Accept both "marks_awarded" and "marks" field names
    const rawMarks = parsed.marks_awarded ?? parsed.marks ?? 0;
    const geminiIsCorrect = parsed.is_correct === true;

    // If Gemini says correct but gave 0 marks — fix it to full marks
    let finalMarks: number;
    if (geminiIsCorrect && Number(rawMarks) === 0) {
      finalMarks = maxMarks;
    } else {
      finalMarks = Math.min(Math.max(Math.round(Number(rawMarks)), 0), maxMarks);
    }

    // Accept multiple possible feedback field names from Gemini
    const aiFeedback: string =
      parsed.ai_feedback ||
      parsed.feedback ||
      parsed.explanation ||
      parsed.reason ||
      (geminiIsCorrect ? "Answer is correct." : "Answer is incorrect.");

    return {
      marks: finalMarks,
      is_correct: geminiIsCorrect,
      ai_feedback: aiFeedback,
    };
  } catch (err) {
    console.error('[Gemini] Failed:', JSON.stringify(err, Object.getOwnPropertyNames(err as object)));

    // Fallback: keyword matching with partial marks
    const studentNorm = normalize(studentAnswer);
    const correctNorm = normalize(correctAnswer);
    const correctWords = correctNorm.split(' ').filter((w) => w.length > 2);
    const matchCount = correctWords.filter((w) => studentNorm.includes(w)).length;
    const matchRatio = correctWords.length > 0 ? matchCount / correctWords.length : 0;

    console.log(`[Fallback] matchRatio=${matchRatio}`);

    const isCorrect = matchRatio >= 0.6;
    const fallbackMarks = isCorrect
      ? maxMarks
      : matchRatio >= 0.3
      ? Math.round(maxMarks * 0.5)
      : 0;

    return {
      marks: fallbackMarks,
      is_correct: isCorrect,
      ai_feedback: isCorrect
        ? "Answer accepted based on keyword matching (AI temporarily unavailable)."
        : matchRatio >= 0.3
        ? "Partial credit awarded — some key concepts present (AI temporarily unavailable)."
        : "Answer does not match expected response (AI temporarily unavailable).",
    };
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { session_id } = body;

    console.log('[grade-answers] session_id:', session_id, 'user:', user.id);

    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }

    // Fetch session
    const { data: allSessions, error: sessionError } = await supabase.rpc(
      'get_student_sessions',
      { student_id_param: user.id }
    );

    console.log('[grade-answers] sessions count:', allSessions?.length, 'error:', sessionError);

    if (sessionError) {
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    const session = (allSessions ?? []).find((s: any) => s.id === session_id);

    if (!session) {
      return NextResponse.json({ error: "Session not found or access denied" }, { status: 404 });
    }

    console.log('[grade-answers] found session:', session.id);

    // Fetch questions
    const { data: questions, error: questionsError } = await supabase.rpc(
      "get_exam_questions",
      { exam_id_param: session.exam_id }
    );

    console.log('[grade-answers] questions fetched:', questions?.length, 'error:', questionsError);

    if (questionsError || !questions) {
      return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }

    // Fetch exam settings
    const { data: examData } = await supabase.rpc("get_exam_by_id", {
      exam_id_param: session.exam_id,
    });
    const exam = Array.isArray(examData) ? examData[0] : examData;
    const allowSpellingMistakes = exam?.allow_spelling_mistakes ?? false;

    console.log('[grade-answers] allowSpellingMistakes:', allowSpellingMistakes);

    const studentAnswers: Record<string, string> = session.answers || {};

    let totalScore = 0;
    let maxScore = 0;
    const updatedGradingDetails: GradingDetails = {};

    for (const question of questions) {
      const qId = question.id;
      const studentAnswer = studentAnswers[qId] ?? null;
      const maxMarks = question.marks || 1;
      maxScore += maxMarks;

      console.log(`[grade-answers] Q ${qId} type=${question.type} answer="${studentAnswer}" correct="${question.correct_answer}"`);

      if (question.type === "mcq") {
        // MCQ: exact match only, no Gemini needed
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
          ai_feedback: isCorrect ? "Correct answer selected." : "Incorrect answer selected.",
        };

      } else {
        // short_answer AND long_answer — ALWAYS grade with Gemini, never skip
        if (!studentAnswer || studentAnswer.trim() === "") {
          updatedGradingDetails[qId] = {
            question_text: question.question_text,
            student_answer: studentAnswer,
            correct_answer: question.correct_answer,
            is_correct: false,
            marks_awarded: 0,
            needs_grading: false,
            type: question.type,
            ai_feedback: "No answer was provided.",
          };
        } else {
          console.log(`[grade-answers] Sending Q ${qId} (${question.type}) to Gemini...`);

          const { marks, is_correct, ai_feedback } = await gradeSubjectiveAnswer({
            questionText: question.question_text,
            studentAnswer: studentAnswer.trim(),
            correctAnswer: question.correct_answer,
            maxMarks,
            questionType: question.type,
            gradingHint: question.grading_hint,
            allowSpellingMistakes,
          });

          console.log(`[grade-answers] Result Q ${qId}: marks=${marks}/${maxMarks} is_correct=${is_correct} feedback="${ai_feedback}"`);

          totalScore += marks;
          updatedGradingDetails[qId] = {
            question_text: question.question_text,
            student_answer: studentAnswer,
            correct_answer: question.correct_answer,
            is_correct,
            marks_awarded: marks,
            needs_grading: false,
            type: question.type,
            ai_feedback,
          };
        }
      }
    }

    console.log('[grade-answers] final totalScore:', totalScore, '/', maxScore);

    // Save results
    const { error: submitError } = await supabase.rpc("submit_exam_session", {
      session_id_param: session_id,
      answers_param: studentAnswers,
      score_param: totalScore,
      max_score_param: maxScore,
      grading_details_param: updatedGradingDetails,
    });

    console.log('[grade-answers] submitError:', submitError);

    if (submitError) {
      return NextResponse.json({ error: "Failed to save grading results" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      score: totalScore,
      max_score: maxScore,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      grading_details: updatedGradingDetails,
    });

  } catch (err) {
    console.error("[grade-answers] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}