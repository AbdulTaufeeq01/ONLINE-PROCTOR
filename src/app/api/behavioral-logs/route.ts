import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      session_id,
      student_id,
      exam_id,
      question_id,
      tab_switches,
      paste_events,
      keystroke_timeline,
      mouse_leave_events,
      focus_loss_events,
      window_blur_count,
      total_time_seconds,
      suspicious_patterns,
    } = body

    console.log('[behavioral-logs] Storing log for session:', session_id, {
      paste_events: paste_events?.length,
      keystrokes: keystroke_timeline?.length,
      suspicious: suspicious_patterns?.length,
    })

    // Validate required fields
    if (!session_id || !student_id || !exam_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate behavioral risk score from this log
    let risk_score = 0

    // Paste events: each event = 5 points, large pastes = +5
    const paste_score = Math.min(
      20,
      (paste_events?.length ?? 0) * 5 +
        (paste_events?.filter((p: any) => p.charCount > 100).length ?? 0) * 5
    )
    risk_score += paste_score

    // Focus loss: each event = 3 points
    const focus_score = Math.min(15, (focus_loss_events ?? 0) * 3)
    risk_score += focus_score

    // Mouse leave: each event = 2 points
    const mouse_score = Math.min(10, (mouse_leave_events ?? 0) * 2)
    risk_score += mouse_score

    // Typing bursts: indicate suspicious pasting/copying
    const burst_events = keystroke_timeline?.filter(
      (k: any) => k.charCount > 200 && k.duration < 3000
    ) ?? []
    const typing_score = Math.min(20, burst_events.length * 10)
    risk_score += typing_score

    const final_risk = Math.min(100, risk_score)

    console.log('[behavioral-logs] Calculated risk score:', final_risk, {
      paste_score,
      focus_score,
      mouse_score,
      typing_score,
    })

    // Store in database (if we add the table later)
    // For now, just log and return success
    const { error: insertError } = await supabaseAdmin
      .from('behavior_logs')
      .insert({
        session_id,
        student_id,
        exam_id,
        event_type: 'detailed_behavioral_log',
        confidence: Math.min(1, final_risk / 100),
        metadata: {
          question_id,
          tab_switches,
          paste_events: paste_events?.length ?? 0,
          keystroke_events: keystroke_timeline?.length ?? 0,
          mouse_leave_events,
          focus_loss_events,
          window_blur_count,
          total_time_seconds,
          suspicious_patterns,
          burst_events: burst_events.length,
          risk_score: final_risk,
        },
      })

    if (insertError) {
      console.error('[behavioral-logs] Insert error:', insertError)
      // Continue anyway - log was calculated
    } else {
      console.log('[behavioral-logs] ✅ Behavioral log stored')
    }

    return NextResponse.json({
      success: true,
      risk_score: final_risk,
      risk_level:
        final_risk >= 60
          ? 'high'
          : final_risk >= 30
            ? 'medium'
            : 'low',
      message: 'Behavioral log recorded',
    })
  } catch (err) {
    console.error('[behavioral-logs] Error:', err)
    return NextResponse.json(
      { error: 'Failed to store behavioral log' },
      { status: 500 }
    )
  }
}
