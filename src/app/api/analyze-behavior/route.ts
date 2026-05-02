// src/app/api/analyze-behavior/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { detectAIWrittenContent } from '@/lib/ai-detection'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high:     15,
  medium:    8,
  low:       3,
}

const FLAG_TYPE_SEVERITY: Record<string, string> = {
  multiple_faces:     'critical',
  no_face:            'high',
  copy_paste:         'high',
  noise_exam_locked:  'high',
  tab_switch:         'medium',
  window_blur:        'medium',
  fullscreen_exit:    'medium',
  loud_sound:         'medium',
  voice_detected:     'medium',
  eye_away:           'low',
  phone_suspected:    'low',
  copy_attempt:       'low',
}

function hasBurst(
  events: { created_at: string }[],
  windowMs: number,
  threshold: number
): boolean {
  if (events.length < threshold) return false
  const times = events.map((e) => new Date(e.created_at).getTime()).sort()
  for (let i = 0; i <= times.length - threshold; i++) {
    if (times[i + threshold - 1] - times[i] <= windowMs) return true
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json()

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    console.log('[analyze-behavior] Starting for session:', session_id)

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, exam_id, student_id, grading_details, score, max_score, started_at, submitted_at')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: flags } = await supabaseAdmin
      .from('flags')
      .select('id, flag_type, severity, created_at, metadata')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })

    const allFlags = flags ?? []
    console.log('[analyze-behavior] flags:', allFlags.length)

    const { data: behaviorLogs } = await supabaseAdmin
      .from('behavior_logs')
      .select('id, event_type, confidence, created_at, metadata')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })

    const allLogs = behaviorLogs ?? []
    console.log('[analyze-behavior] behavior_logs:', allLogs.length)

    // ── STEP 1 — FLAG SCORE ───────────────────────────────────────────────────
    const flagBreakdown: Record<string, { count: number; points: number; severity: string }> = {}
    let rawFlagScore = 0

    for (const flag of allFlags) {
      const severity = flag.severity ?? FLAG_TYPE_SEVERITY[flag.flag_type] ?? 'low'
      const points   = SEVERITY_WEIGHTS[severity] ?? 3
      rawFlagScore  += points

      if (!flagBreakdown[flag.flag_type]) {
        flagBreakdown[flag.flag_type] = { count: 0, points: 0, severity }
      }
      flagBreakdown[flag.flag_type].count  += 1
      flagBreakdown[flag.flag_type].points += points
    }

    const flagScore = Math.min(100, rawFlagScore)
    console.log('[analyze-behavior] flagScore:', flagScore)

    // ── STEP 2 — PATTERN SCORE ────────────────────────────────────────────────
    const tabSwitchEvents = allFlags.filter((f) => f.flag_type === 'tab_switch')
    const faceAbsences    = allFlags.filter((f) => f.flag_type === 'no_face')
    const multipleFaces   = allFlags.filter((f) => f.flag_type === 'multiple_faces')
    const pasteEvents     = allFlags.filter((f) => f.flag_type === 'copy_paste')

    const tabBurstScore        = hasBurst(tabSwitchEvents, 5 * 60 * 1000, 3) ? 30 : 0
    const extendedAbsenceScore = Math.min(25, faceAbsences.length * 4)
    const multipleFaceScore    = Math.min(35, multipleFaces.length * 15)
    const pasteScore           = Math.min(35, pasteEvents.length * 15)
    const noiseLocked          = allLogs.some((l) => l.event_type === 'noise_exam_locked')
    const noiseLockScore       = noiseLocked ? 20 : 0
    const speedAnomalyScore    = allLogs
      .filter((l) => l.event_type === 'answer_speed_anomaly')
      .reduce((sum) => sum + 15, 0)

    const patternScore = Math.min(
      100,
      tabBurstScore + extendedAbsenceScore + multipleFaceScore +
      pasteScore + noiseLockScore + speedAnomalyScore
    )

    console.log('[analyze-behavior] patternScore:', patternScore, {
      tabBurstScore, extendedAbsenceScore, multipleFaceScore, pasteScore, noiseLockScore,
    })

    // ── STEP 3 — AI WRITING SCORE ─────────────────────────────────────────────
    const gradingDetails = (session.grading_details ?? {}) as Record<string, any>

    const subjectiveAnswers: Record<
      string,
      { question_text: string; student_answer: string; type: 'short_answer' | 'long_answer' }
    > = {}

    for (const [qId, detail] of Object.entries(gradingDetails)) {
      if (
        detail.type !== 'mcq' &&
        detail.student_answer &&
        detail.student_answer.trim().length >= 20
      ) {
        subjectiveAnswers[qId] = {
          question_text:  detail.question_text ?? '',
          student_answer: detail.student_answer,
          type:           detail.type ?? 'short_answer',
        }
      }
    }

    let aiWritingResult = null
    let aiWritingScore  = 0

    if (Object.keys(subjectiveAnswers).length > 0) {
      try {
        aiWritingResult = await detectAIWrittenContent(subjectiveAnswers, 'medium')
        aiWritingScore  = aiWritingResult.overall_ai_score
        console.log('[analyze-behavior] aiWritingScore:', aiWritingScore, 'risk:', aiWritingResult.risk_level)
      } catch (err) {
        console.error('[analyze-behavior] AI writing detection failed:', err)
      }
    }

    // ── STEP 4 — COMPOSITE CHEATING SCORE ────────────────────────────────────
    // ✅ FIXED: Ensure cheating_score is 0-100, NOT a percentage
    // The score should be stored as a 0-100 integer, never multiplied by 100 again
    const rawCheatingScore = 
      flagScore * 0.40 +
      patternScore * 0.35 +
      aiWritingScore * 0.25;
    
    const cheatingScore = Math.min(100, Math.round(rawCheatingScore));

    const riskLevel =
      cheatingScore >= 71 ? 'critical'
      : cheatingScore >= 46 ? 'high'
      : cheatingScore >= 21 ? 'moderate'
      : 'low'

    console.log('[analyze-behavior] cheatingScore:', cheatingScore, 'risk:', riskLevel, 'rawCalc:', rawCheatingScore)

    // ── STEP 5 — BUILD AI REPORT ──────────────────────────────────────────────
    const aiReport = {
      generated_at:  new Date().toISOString(),
      cheating_score: cheatingScore,
      risk_level:    riskLevel,
      score_breakdown: {
        flag_score:       flagScore,
        pattern_score:    patternScore,
        ai_writing_score: aiWritingScore,
        weights:          { flags: 0.40, patterns: 0.35, ai_writing: 0.25 },
      },
      flag_breakdown: flagBreakdown,
      patterns_detected: {
        tab_burst:        tabBurstScore > 0,
        extended_absence: faceAbsences.length >= 5,
        multiple_faces:   multipleFaces.length > 0,
        copy_paste_used:  pasteEvents.length > 0,
        noise_locked:     noiseLocked,
      },
      ai_writing_analysis: aiWritingResult
        ? {
            overall_ai_score: aiWritingResult.overall_ai_score,
            risk_level:       aiWritingResult.risk_level,
            summary:          aiWritingResult.summary,
            per_question:     aiWritingResult.per_question,
          }
        : null,
      event_counts: {
        total_flags:    allFlags.length,
        total_logs:     allLogs.length,
        tab_switches:   tabSwitchEvents.length,
        face_absences:  faceAbsences.length,
        multiple_faces: multipleFaces.length,
        copy_paste:     pasteEvents.length,
      },
    }

    // ── STEP 6 — SAVE: direct update (bypasses RPC jsonb cast bug) ───────────
    //
    // The update_session_ai_report RPC has p_ai_report_param typed as `text`
    // in its SQL definition, but the column is jsonb — PostgreSQL error 42804.
    // Using supabaseAdmin.from().update() passes jsonb natively and avoids
    // the cast entirely. This is the permanent fix until the RPC is patched.
    //
    const { error: directUpdateError } = await supabaseAdmin
      .from('exam_sessions')
      .update({
        ai_report:       aiReport,          // plain object → stored as jsonb ✅
        cheating_score:  cheatingScore,
        grading_details: gradingDetails,
        score:           session.score ?? 0,
      })
      .eq('id', session_id)

    if (directUpdateError) {
      console.error('[analyze-behavior] direct update failed:', directUpdateError)
      // Last-resort: try the RPC even though it may cast incorrectly —
      // at minimum cheating_score (a numeric) will be saved correctly.
      await supabaseAdmin.rpc('update_session_ai_report', {
        p_session_id:            session_id,
        p_ai_report_param:       JSON.stringify(aiReport), // cast workaround
        p_cheating_score_param:  cheatingScore,
        p_grading_details_param: gradingDetails,
        p_final_score_param:     session.score ?? 0,
      })
    } else {
      console.log('[analyze-behavior] session updated successfully')
    }

    return NextResponse.json({
      success:          true,
      cheating_score:   cheatingScore,
      risk_level:       riskLevel,
      score_breakdown:  aiReport.score_breakdown,
      flag_breakdown:   flagBreakdown,
      ai_writing_score: aiWritingScore,
    })
  } catch (err) {
    console.error('[analyze-behavior] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}