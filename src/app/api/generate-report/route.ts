import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface FlagSummary {
  flag_type: string
  count: number
  severity: string
}

interface SessionReport {
  session_id: string
  student_name: string
  student_email: string
  score: number
  max_score: number
  percentage: number
  passed: boolean
  cheating_score: number
  submitted_at: string | null
  flags: FlagSummary[]
  behavior_summary: Record<string, number>
  ai_insight?: string
}

async function generateAIInsight(
  studentName: string,
  score: number,
  maxScore: number,
  percentage: number,
  cheatingScore: number,
  flags: FlagSummary[],
  behaviorSummary: Record<string, number>
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const flagsSummary =
    flags.length > 0
      ? flags.map((f) => `${f.flag_type} (×${f.count}, ${f.severity})`).join(', ')
      : 'None'

  const behaviorText =
    Object.keys(behaviorSummary).length > 0
      ? Object.entries(behaviorSummary).map(([k, v]) => `${k}: ${v}`).join(', ')
      : 'No behavioral events recorded'

  const prompt = `You are an exam integrity analyst. Write a concise 2-3 sentence professional report insight for a student's exam session.

Student: ${studentName}
Score: ${score}/${maxScore} (${percentage}%)
Cheating Risk Score: ${cheatingScore}/100
Security Flags: ${flagsSummary}
Behavioral Events: ${behaviorText}

Instructions:
- Be factual, neutral, and professional.
- Mention academic performance and any integrity concerns.
- If cheating score > 50 or high-severity flags exist, note the concern clearly.
- Keep it under 60 words.
- Return plain text only, no markdown.`

  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { exam_id, include_ai_insights = true } = body

    if (!exam_id) {
      return NextResponse.json({ error: 'exam_id is required' }, { status: 400 })
    }

    // Verify teacher owns this exam
    const { data: examData, error: examError } = await (supabase.rpc as any)(
      'get_teacher_exam',
      { exam_id_param: exam_id, teacher_id_param: user.id }
    )

    if (examError || !(examData as any)?.length) {
      return NextResponse.json(
        { error: 'Exam not found or access denied' },
        { status: 404 }
      )
    }

    const exam = examData[0]

    // Fetch all submitted sessions for this exam
    const { data: sessionsRaw, error: sessionsError } = await (supabase.rpc as any)(
      'get_exam_sessions_for_report',
      { exam_id_param: exam_id }
    );

    if (sessionsError) {
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    const sessions = sessionsRaw ?? []
    const sessionReports: SessionReport[] = []

    for (const session of sessions) {
      // Fetch flags per session
      const { data: flagsRaw } = await (supabase.rpc as any)(
        'get_exam_flags',
        { session_id_param: session.id }
      )
      const sessionFlags = flagsRaw ?? []

      // Aggregate flags
      const flagMap: Record<string, FlagSummary> = {}
      for (const flag of sessionFlags) {
        const key = flag.flag_type
        if (!flagMap[key]) {
          flagMap[key] = { flag_type: key, count: 0, severity: flag.severity }
        }
        flagMap[key].count++
        if (flag.severity === 'high') flagMap[key].severity = 'high'
        else if (flag.severity === 'medium' && flagMap[key].severity !== 'high') {
          flagMap[key].severity = 'medium'
        }
      }
      const flags = Object.values(flagMap)

      // Fetch behavior logs per session
      const { data: behaviorRaw } = await (supabase.rpc as any)(
        'get_exam_behavior_logs',
        { session_id_param: session.id }
      )
      const sessionBehavior = behaviorRaw ?? []

      // Aggregate behavior
      const behaviorSummary: Record<string, number> = {}
      for (const log of sessionBehavior) {
        behaviorSummary[log.event_type] = (behaviorSummary[log.event_type] ?? 0) + 1
      }

      const percentage =
        session.max_score > 0
          ? Math.round((session.score / session.max_score) * 100)
          : 0

      const passed = exam.pass_marks
        ? session.score >= exam.pass_marks
        : percentage >= 50

      const report: SessionReport = {
        session_id: session.id,
        student_name: session.student_name ?? 'Unknown',
        student_email: session.student_email ?? '',
        score: session.score ?? 0,
        max_score: session.max_score ?? 0,
        percentage,
        passed,
        cheating_score: session.cheating_score ?? 0,
        submitted_at: session.submitted_at,
        flags,
        behavior_summary: behaviorSummary,
      }

      // Generate AI insight per session
      if (include_ai_insights) {
        try {
          report.ai_insight = await generateAIInsight(
            report.student_name,
            report.score,
            report.max_score,
            report.percentage,
            report.cheating_score,
            flags,
            behaviorSummary
          )
        } catch {
          report.ai_insight = undefined
        }
      }

      // Persist ai_report via RPC
      if (report.ai_insight) {
        await (supabase.rpc as any)('update_session_ai_report', {
          session_id_param: session.id,
          ai_report_param: report.ai_insight,
        })
      }

      sessionReports.push(report)
    }

    // Exam-level statistics
    const submitted = sessionReports.filter((s) => s.submitted_at)
    const avgScore =
      submitted.length > 0
        ? Math.round(
            submitted.reduce((sum, s) => sum + s.percentage, 0) / submitted.length
          )
        : 0

    const highRisk = sessionReports.filter((s) => s.cheating_score > 60).length
    const passCount = sessionReports.filter((s) => s.passed).length

    const totalBehaviorEvents: Record<string, number> = {}
    for (const report of sessionReports) {
      for (const [event, count] of Object.entries(report.behavior_summary)) {
        totalBehaviorEvents[event] = (totalBehaviorEvents[event] ?? 0) + count
      }
    }

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        pass_marks: exam.pass_marks,
        duration_minutes: exam.duration_minutes,
        status: exam.status,
      },
      statistics: {
        total_students: sessionReports.length,
        submitted_count: submitted.length,
        pass_count: passCount,
        pass_rate:
          submitted.length > 0
            ? Math.round((passCount / submitted.length) * 100)
            : 0,
        average_score: avgScore,
        high_risk_students: highRisk,
        total_behavioral_events: totalBehaviorEvents,
      },
      sessions: sessionReports,
    })
  } catch (err) {
    console.error('generate-report error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
