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

    await supabase.from('behavior_logs').insert({
      session_id,
      student_id,
      exam_id,
      event_type,
      confidence,
      metadata,
      created_at: new Date().toISOString()
    })

    await supabase.from('flags').insert({
      session_id,
      student_id,
      exam_id,
      flag_type: event_type,
      severity: severity ?? 'medium',
      metadata,
      created_at: new Date().toISOString()
    })

    return Response.json({ success: true })
  } catch (err) {
    console.error('flag-event error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
