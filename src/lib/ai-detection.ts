import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface AIDetectionResult {
  overall_ai_score: number; // 0-100
  per_question: Record<
    string,
    {
      ai_score: number;
      confidence: string;
      explanation: string;
      is_flagged: boolean;
    }
  >;
  summary: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Detect AI-written content in exam answers
 * @param answers - Answers object with question_text, student_answer, and type
 * @param sensitivity - Sensitivity level for flagging
 * @returns AI detection result with per-question analysis
 */
export async function detectAIWrittenContent(
  answers: Record<
    string,
    {
      question_text: string;
      student_answer: string;
      type: 'short_answer' | 'long_answer';
    }
  >,
  sensitivity: 'low' | 'medium' | 'high' = 'medium'
): Promise<AIDetectionResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Sensitivity thresholds
  const thresholds = {
    low: 80,
    medium: 65,
    high: 50,
  };
  const threshold = thresholds[sensitivity];

  const perQuestion: Record<
    string,
    {
      ai_score: number;
      confidence: string;
      explanation: string;
      is_flagged: boolean;
    }
  > = {};

  const scores: number[] = [];

  // Analyze each subjective answer
  for (const [questionId, answer] of Object.entries(answers)) {
    // Skip MCQ and empty answers
    if (answer.type === 'mcq' || !answer.student_answer.trim()) {
      continue;
    }

    try {
      const prompt = `Analyze whether this exam answer was written by AI or a human student.

Question: ${answer.question_text}

Answer: ${answer.student_answer}

Consider: unusual formality, perfect structure, no personal voice, hedging phrases, comprehensive coverage without errors.

Sensitivity level: ${sensitivity} (${sensitivity === 'low' ? 'only flag obvious AI' : sensitivity === 'high' ? 'flag any suspicious patterns' : 'balanced detection'})

Respond in JSON only:
{ "ai_score": number (0-100), "confidence": "low" | "medium" | "high", "explanation": "string" }`;

      const content = await model.generateContent(prompt);
      const responseText = content.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\\{[^}]+\\}/);
      if (!jsonMatch) throw new Error('Invalid JSON response');

      const parsed = JSON.parse(jsonMatch[0]);
      const aiScore = Math.min(100, Math.max(0, parsed.ai_score || 0));
      const isFlagged = aiScore >= threshold;

      perQuestion[questionId] = {
        ai_score: aiScore,
        confidence: parsed.confidence || 'medium',
        explanation:
          parsed.explanation ||
          `AI detection score: ${aiScore}. ${isFlagged ? 'Flagged as suspicious.' : 'Appears authentic.'}`,
        is_flagged: isFlagged,
      };

      scores.push(aiScore);
    } catch (error) {
      console.error(`Error analyzing question ${questionId}:`, error);
      // Treat errors conservatively - assume authentic
      perQuestion[questionId] = {
        ai_score: 0,
        confidence: 'low',
        explanation: 'Unable to analyze this answer (technical error)',
        is_flagged: false,
      };
    }
  }

  // Calculate overall score
  const overallAiScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (overallAiScore >= 80) {
    riskLevel = 'critical';
  } else if (overallAiScore >= 65) {
    riskLevel = 'high';
  } else if (overallAiScore >= 50) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Generate summary
  const flaggedCount = Object.values(perQuestion).filter(
    (q) => q.is_flagged
  ).length;
  const totalCount = Object.keys(perQuestion).length;

  let summary = `AI Detection Analysis: ${totalCount} subjective answer(s) analyzed.`;
  if (flaggedCount === 0) {
    summary += ' No suspicious AI patterns detected.';
  } else if (flaggedCount === totalCount) {
    summary += ` ALL ${flaggedCount} answer(s) show high AI probability.`;
  } else {
    summary += ` ${flaggedCount} out of ${totalCount} answer(s) flagged as suspicious.`;
  }
  summary += ` Overall risk: ${riskLevel}.`;

  return {
    overall_ai_score: overallAiScore,
    per_question: perQuestion,
    summary,
    risk_level: riskLevel,
  };
}
