import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      session_id, student_id, exam_id,
      event_type, confidence, metadata, severity
    } = await request.json()

    console.log('flag-event:', event_type, 'session:', session_id)

    // Insert behavior log via RPC
    const { error: logError } = await supabase.rpc('insert_behavior_log', {
      session_id_param: session_id,
      student_id_param: student_id,
      exam_id_param: exam_id,
      event_type_param: event_type,
      confidence_param: confidence,
      metadata_param: metadata ?? {},
    })

    console.log('behavior log error:', logError)

    // Insert flag via RPC
    const { error: flagError } = await supabase.rpc('insert_flag', {
      session_id_param: session_id,
      student_id_param: student_id,
      exam_id_param: exam_id,
      flag_type_param: event_type,
      severity_param: severity ?? 'medium',
      metadata_param: metadata ?? {},
    })

    console.log('flag error:', flagError)

    return Response.json({ success: true })
  } catch (err) {
    console.error('flag-event error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}