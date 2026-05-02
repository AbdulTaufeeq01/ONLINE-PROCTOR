/**
 * Grading utilities for MCQ, short answer, and long answer questions
 */

/**
 * Grade MCQ answer
 */
export function gradeMCQ(
  studentAnswer: string,
  correctAnswer: string
): { is_correct: boolean; marks_awarded: number; max_marks: number } {
  const isCorrect =
    studentAnswer.toLowerCase().trim() ===
    correctAnswer.toLowerCase().trim();

  return {
    is_correct: isCorrect,
    marks_awarded: isCorrect ? 1 : 0,
    max_marks: 1,
  };
}

/**
 * Normalize common abbreviations
 */
export function normalizeAbbreviations(text: string): string {
  let normalized = text;

  // Common abbreviations
  const abbreviations: Record<string, string> = {
    '\\\\b(AI|ai)\\\\b': 'Artificial Intelligence',
    '\\\\b(ML|ml)\\\\b': 'Machine Learning',
    '\\\\b(UK|uk)\\\\b': 'United Kingdom',
    '\\\\b(US|USA|usa)\\\\b': 'United States',
    '\\\\b(WW2|WWII|ww2|wwii)\\\\b': 'World War 2',
    '\\\\b(COVID|covid)\\\\b': 'COVID-19',
  };

  for (const [abbr, full] of Object.entries(abbreviations)) {
    normalized = normalized.replace(new RegExp(abbr, 'g'), full);
  }

  return normalized;
}

/**
 * Build grading prompt for Gemini
 */
export function buildGradingPrompt(params: {
  question_text: string;
  student_answer: string;
  correct_answer: string;
  max_marks: number;
  question_type: 'short_answer' | 'long_answer';
  grading_hint?: string;
  allow_spelling_mistakes?: boolean;
}): string {
  const {
    question_text,
    student_answer,
    correct_answer,
    max_marks,
    question_type,
    grading_hint,
    allow_spelling_mistakes,
  } = params;

  const isShort = question_type === 'short_answer';
  const leniency = isShort ? 0 : 0.2; // 20% leniency for long answers
  const maxMarksAdjusted = Math.ceil(max_marks * (1 - leniency));

  return `You are an exam grader. Grade this student's answer.

Question: ${question_text}

Expected answer: ${correct_answer}${grading_hint ? `\
Grading hint: ${grading_hint}` : ''}

Student's answer: ${student_answer}

Grading rules:
1. Compare MEANING, not exact wording.
2. Treat abbreviations as equal to full forms (AI = Artificial Intelligence).
${allow_spelling_mistakes ? '3. Spelling mistakes should NOT reduce marks.\
' : '3. Minor spelling mistakes should NOT significantly reduce marks.\
'}4. Extra filler words do NOT reduce marks if the core answer is correct.
5. Missing key facts = reduced or zero marks.
${!isShort ? '6. Long answers: Apply 20% leniency for structure vs short answers.\
' : ''}7. Full marks = student demonstrated complete understanding.
8. Zero marks = student answer is incorrect or missing key concepts.

Max marks: ${max_marks}

Respond in JSON only:
{
  "marks": number (0-${max_marks}, ${!isShort ? 'with 20% leniency applied' : 'strict'}),
  "is_correct": boolean (true if demonstrates correct understanding),
  "ai_feedback": "string (one sentence explanation of grade)"
}`;
}

/**
 * Calculate final exam score
 */
export function calculateFinalScore(gradingDetails: Record<string, {
  marks_awarded: number | null;
  max_marks: number;
  needs_grading: boolean;
}>): { score: number; max_score: number; percentage: number } {
  let score = 0;
  let max_score = 0;

  for (const detail of Object.values(gradingDetails)) {
    max_score += detail.max_marks;
    if (detail.marks_awarded !== null && typeof detail.marks_awarded === 'number') {
      score += detail.marks_awarded;
    }
  }

  const percentage =
    max_score > 0 ? Math.round((score / max_score) * 100 * 10) / 10 : 0;

  return {
    score: Math.round(score * 100) / 100,
    max_score,
    percentage,
  };
}
