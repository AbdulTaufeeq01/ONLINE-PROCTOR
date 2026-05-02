import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Must use service role — proctoring events are posted from the client-side
// exam page and may not have valid session cookies at the time of the request.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      session_id,
      student_id,
      exam_id,
      flag_type,
      event_type,
      severity = 'medium',
      confidence = 0.5,
      metadata = {},
      // log_type controls what gets written:
      //   'flag'         → flags table + behavior_logs (default)
      //   'behavior_log' → behavior_logs only (used by useNoiseDetection)
      //   'both'         → both tables (explicit alias for 'flag')
      log_type = 'flag',
    } = body

    console.log('[flag-event] 📨 REQUEST RECEIVED:', { // ✅ ENHANCED: show incoming request
      log_type,
      event_type,
      flag_type,
      session_id,
      student_id,
      exam_id,
      severity,
      confidence,
    })

    if (!session_id || !student_id || !exam_id) {
      console.error('[flag-event] ❌ MISSING REQUIRED FIELDS:', { session_id, student_id, exam_id }) // ✅ NEW
      return NextResponse.json(
        { error: 'session_id, student_id, and exam_id are required' },
        { status: 400 }
      )
    }

    // Resolve the event/flag type strings:
    // Some callers send event_type, some send flag_type, some send both.
    const resolvedEventType = event_type ?? flag_type ?? 'unknown'
    const resolvedFlagType  = flag_type  ?? event_type ?? 'unknown'

    const errors: string[] = []

    // ── Always write a behavior_log entry ─────────────────────────────────────
    console.log('[flag-event] 📝 Calling insert_behavior_log with:', { // ✅ NEW
      p_session_id: session_id,
      p_student_id: student_id,
      p_exam_id: exam_id,
      p_event_type_param: resolvedEventType, // ✅ FIXED: was p_event_type
      p_confidence_param: Math.min(Math.max(Number(confidence) || 0, 0), 1), // ✅ FIXED: was p_confidence
    })

    const { error: logError } = await supabaseAdmin.rpc('insert_behavior_log', {
      p_session_id: session_id,
      p_student_id: student_id,
      p_exam_id:    exam_id,
      p_event_type_param: resolvedEventType, // ✅ FIXED from p_event_type
      p_confidence_param: Math.min(Math.max(Number(confidence) || 0, 0), 1), // ✅ FIXED from p_confidence
      p_metadata_param:   metadata, // ✅ FIXED from p_metadata
    })

    if (logError) {
      console.error('[flag-event] ❌ insert_behavior_log error:', logError) // ✅ ENHANCED
      errors.push(`behavior_log: ${logError.message}`)
    } else {
      console.log('[flag-event] ✅ insert_behavior_log succeeded') // ✅ NEW
    }

    // ── Write a flags entry only when log_type is 'flag' or 'both' ───────────
    if (log_type === 'flag' || log_type === 'both') {
      console.log('[flag-event] 📝 Calling insert_flag with:', { // ✅ NEW
        p_session_id: session_id,
        p_student_id: student_id,
        p_exam_id: exam_id,
        p_flag_type_param: resolvedFlagType, // ✅ FIXED: was p_flag_type
        p_severity_param: severity, // ✅ FIXED: was p_severity
      })

      const { error: flagError } = await supabaseAdmin.rpc('insert_flag', {
        p_session_id: session_id,
        p_student_id: student_id,
        p_exam_id:    exam_id,
        p_flag_type_param:  resolvedFlagType, // ✅ FIXED from p_flag_type
        p_severity_param:   severity, // ✅ FIXED from p_severity
        p_metadata_param:   metadata, // ✅ FIXED from p_metadata
      })

      if (flagError) {
        console.error('[flag-event] ❌ insert_flag error:', flagError) // ✅ ENHANCED
        errors.push(`flag: ${flagError.message}`)
      } else {
        console.log('[flag-event] ✅ insert_flag succeeded') // ✅ NEW
      }
    }

    if (errors.length > 0) {
      console.error('[flag-event] ❌ Errors occurred:', errors) // ✅ NEW
      return NextResponse.json(
        { success: false, errors },
        { status: 500 }
      )
    }

    console.log('[flag-event] ✅ SUCCESS - all RPC calls completed') // ✅ NEW
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[flag-event] ❌ Unexpected error:', err) // ✅ ENHANCED
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}