import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { compareAnswers } from '@/lib/semantic-similarity'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface CombinedRiskInput {
  question_id: string
  student_a: {
    id: string
    answer: string
    behavioral_score?: number
  }
  student_b: {
    id: string
    answer: string
    behavioral_score?: number
  }
}

export interface CombinedRiskResult {
  question_id: string
  student_pair: [string, string]
  similarity_score: number
  similarity_percent: number
  similarity_verdict: string
  behavioral_score_a: number
  behavioral_score_b: number
  average_behavioral_score: number
  final_risk_score: number
  risk_level: string
  breakdown: {
    similarity: number
    behavioral: number
  }
  weights: {
    similarity: number
    behavioral: number
  }
  teacher_verdict: string
  flagged_for_review: boolean
  timestamp: string
}

/**
 * POST /api/combined-risk
 * Calculate combined cheating risk for two student answers
 * Combines semantic similarity + behavioral scores
 */
export async function POST(req: NextRequest) {
  try {
    const body: CombinedRiskInput = await req.json()

    const {
      question_id,
      student_a,
      student_b,
    } = body

    console.log('[combined-risk] Computing risk for students', {
      student_a: student_a.id,
      student_b: student_b.id,
      question_id,
    })

    // ── STEP 1: Get semantic similarity ──────────────────────────────────────
    let similarity_score = 0
    let similarity_verdict = 'unknown'

    try {
      const similarityResult = await compareAnswers(
        student_a.answer,
        student_b.answer
      )
      similarity_score = similarityResult.similarity
      similarity_verdict = similarityResult.verdict

      console.log('[combined-risk] Similarity result:', {
        similarity: similarity_score,
        verdict: similarity_verdict,
      })
    } catch (err) {
      console.error('[combined-risk] Similarity comparison failed:', err)
      similarity_score = 0
    }

    // ── STEP 2: Get behavioral scores (default to 0 if not provided) ────────
    const behavioralA = student_a.behavioral_score ?? 0
    const behavioralB = student_b.behavioral_score ?? 0
    const avgBehavioral = (behavioralA + behavioralB) / 2

    console.log('[combined-risk] Behavioral scores:', {
      student_a: behavioralA,
      student_b: behavioralB,
      average: avgBehavioral,
    })

    // ── STEP 3: Combine scores with weighted formula ──────────────────────────
    // 60% similarity, 40% behavioral
    const SIMILARITY_WEIGHT = 0.6
    const BEHAVIORAL_WEIGHT = 0.4

    // Convert scores to 0-1 scale if needed
    const normalizedSimilarity = Math.min(1, similarity_score)
    const normalizedBehavioral = Math.min(1, avgBehavioral / 100)

    const final_risk_score = Math.min(
      1,
      (normalizedSimilarity * SIMILARITY_WEIGHT) +
      (normalizedBehavioral * BEHAVIORAL_WEIGHT)
    )

    // ── STEP 4: Determine risk level ────────────────────────────────────────
    let risk_level: string
    if (final_risk_score >= 0.85) {
      risk_level = 'critical' // Almost certainly cheating
    } else if (final_risk_score >= 0.70) {
      risk_level = 'high' // Highly suspicious
    } else if (final_risk_score >= 0.55) {
      risk_level = 'medium' // Suspicious, needs review
    } else {
      risk_level = 'low' // Likely independent
    }

    // ── STEP 5: Generate teacher verdict ────────────────────────────────────
    const flagged_for_review = final_risk_score >= 0.55

    let teacher_verdict: string
    if (risk_level === 'critical') {
      teacher_verdict = `CRITICAL: Both semantic similarity (${(similarity_score * 100).toFixed(0)}%) and behavioral patterns suggest likely collusion. Strong evidence of answer sharing.`
    } else if (risk_level === 'high') {
      teacher_verdict = `HIGH RISK: Answers show very high semantic similarity (${(similarity_score * 100).toFixed(0)}%). Review carefully for collusion.`
    } else if (risk_level === 'medium') {
      teacher_verdict = `MEDIUM RISK: Notable similarity detected (${(similarity_score * 100).toFixed(0)}%). May warrant brief review.`
    } else {
      teacher_verdict = `LOW RISK: Answers appear substantially different. Likely independent responses.`
    }

    const result: CombinedRiskResult = {
      question_id,
      student_pair: [student_a.id, student_b.id],
      similarity_score: normalizedSimilarity,
      similarity_percent: Math.round(similarity_score * 100),
      similarity_verdict,
      behavioral_score_a: behavioralA,
      behavioral_score_b: behavioralB,
      average_behavioral_score: avgBehavioral,
      final_risk_score: Math.round(final_risk_score * 100),
      risk_level,
      breakdown: {
        similarity: Math.round(normalizedSimilarity * 100),
        behavioral: Math.round(normalizedBehavioral * 100),
      },
      weights: {
        similarity: SIMILARITY_WEIGHT * 100,
        behavioral: BEHAVIORAL_WEIGHT * 100,
      },
      teacher_verdict,
      flagged_for_review,
      timestamp: new Date().toISOString(),
    }

    console.log('[combined-risk] Final result:', {
      final_risk: result.final_risk_score,
      risk_level,
      flagged: flagged_for_review,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[combined-risk] Error:', err)
    return NextResponse.json(
      { error: 'Failed to compute combined risk score' },
      { status: 500 }
    )
  }
}
