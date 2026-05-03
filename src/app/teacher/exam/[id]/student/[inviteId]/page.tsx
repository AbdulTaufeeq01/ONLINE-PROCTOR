import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import TeacherNavbar from '@/components/layout/TeacherNavbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = {
  params: Promise<{ id: string; inviteId: string }>;
};

type FlagRow = {
  id: string;
  flag_type: string;
  severity: string;
  created_at: string;
  screenshot_url: string | null;
  metadata: Record<string, unknown> | null;
};

type BehaviorLogRow = {
  id: string;
  event_type: string;
  confidence: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type ExamSessionRow = {
  id: string;
  exam_id: string;
  invite_id: string | null;
  student_id: string | null;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  cheating_score: number | null;
  ai_report: Record<string, any> | null;
  grading_details: Record<string, any> | null;
};

type ExamInviteRow = {
  id: string;
  exam_id: string;
  student_email: string;
  student_name: string | null;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
};

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

const FLAG_TYPE_SEVERITY: Record<string, string> = {
  multiple_faces: 'critical',
  no_face: 'high',
  copy_paste: 'high',
  noise_exam_locked: 'high',
  tab_switch: 'medium',
  window_blur: 'medium',
  fullscreen_exit: 'medium',
  loud_sound: 'medium',
  voice_detected: 'medium',
  eye_away: 'low',
  phone_suspected: 'low',
  copy_attempt: 'low',
};

function hasBurst(
  events: { created_at: string }[],
  windowMs: number,
  threshold: number
): boolean {
  if (events.length < threshold) return false;
  const times = events.map((event) => new Date(event.created_at).getTime()).sort((a, b) => a - b);

  for (let index = 0; index <= times.length - threshold; index++) {
    if (times[index + threshold - 1] - times[index] <= windowMs) {
      return true;
    }
  }

  return false;
}

function normalizeCheatingScore(score: number | null): number {
  if (typeof score !== 'number') return 0;
  return score <= 1 ? score * 100 : score;
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getRiskClass(score: number): string {
  if (score >= 71) return 'bg-red-100 text-red-800';
  if (score >= 46) return 'bg-orange-100 text-orange-800';
  if (score >= 21) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

function calculateFlagScore(flags: FlagRow[]) {
  const breakdown: Record<string, { count: number; points: number; severity: string }> = {};
  let total = 0;

  for (const flag of flags) {
    const severity = flag.severity ?? FLAG_TYPE_SEVERITY[flag.flag_type] ?? 'low';
    const points = SEVERITY_WEIGHTS[severity] ?? 3;
    total += points;

    if (!breakdown[flag.flag_type]) {
      breakdown[flag.flag_type] = { count: 0, points: 0, severity };
    }

    breakdown[flag.flag_type].count += 1;
    breakdown[flag.flag_type].points += points;
  }

  return {
    score: Math.min(100, total),
    breakdown,
  };
}

function calculatePatternScore(flags: FlagRow[], logs: BehaviorLogRow[]) {
  const tabSwitchEvents = flags.filter((flag) => flag.flag_type === 'tab_switch');
  const faceAbsences = flags.filter((flag) => flag.flag_type === 'no_face');
  const multipleFaces = flags.filter((flag) => flag.flag_type === 'multiple_faces');
  const pasteEvents = flags.filter((flag) => flag.flag_type === 'copy_paste');

  const tabBurstScore = hasBurst(tabSwitchEvents, 5 * 60 * 1000, 3) ? 30 : 0;
  const extendedAbsenceScore = Math.min(25, faceAbsences.length * 4);
  const multipleFaceScore = Math.min(35, multipleFaces.length * 15);
  const pasteScore = Math.min(35, pasteEvents.length * 15);
  const noiseLocked = logs.some((log) => log.event_type === 'noise_exam_locked');
  const noiseLockScore = noiseLocked ? 20 : 0;
  const speedAnomalyScore = logs
    .filter((log) => log.event_type === 'answer_speed_anomaly')
    .reduce((sum) => sum + 15, 0);

  const score = Math.min(
    100,
    tabBurstScore + extendedAbsenceScore + multipleFaceScore + pasteScore + noiseLockScore + speedAnomalyScore
  );

  return {
    score,
    details: {
      tabBurstScore,
      extendedAbsenceScore,
      multipleFaceScore,
      pasteScore,
      noiseLockScore,
      speedAnomalyScore,
      noiseLocked,
    },
  };
}

export default async function StudentDetailPage({ params }: Props) {
  const { id, inviteId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const examCall = supabase.rpc('get_teacher_exam', {
    exam_id_param: id,
    teacher_id_param: user.id,
  } as any) as any;

  const { data: examData } = await examCall;
  const exam = examData?.[0] ?? null;

  if (!exam) {
    redirect('/teacher/home');
  }

  const { data: inviteData } = await (supabase.from('exam_invites') as any)
    .select('id, exam_id, student_email, student_name')
    .eq('id', inviteId)
    .eq('exam_id', id)
    .maybeSingle();

  const invite = inviteData as ExamInviteRow | null;

  if (!invite) {
    redirect(`/teacher/exam/${id}/monitor`);
  }

  const { data: sessionData } = await (supabase.from('exam_sessions') as any)
    .select('id, exam_id, invite_id, student_id, status, started_at, submitted_at, score, max_score, cheating_score, ai_report, grading_details')
    .eq('exam_id', id)
    .eq('invite_id', inviteId)
    .maybeSingle();

  const session = sessionData as ExamSessionRow | null;

  const { data: profileData } = session?.student_id
    ? await (supabase.from('profiles') as any)
        .select('id, name, email')
        .eq('id', session.student_id)
        .maybeSingle()
    : { data: null };

  const profile = profileData as ProfileRow | null;

  const { data: flagsData = [] } = session
    ? await (supabase.from('flags') as any)
        .select('id, flag_type, severity, created_at, screenshot_url, metadata')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const { data: logsData = [] } = session
    ? await (supabase.from('behavior_logs') as any)
        .select('id, event_type, confidence, created_at, metadata')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const flags = flagsData as FlagRow[];
  const behaviorLogs = logsData as BehaviorLogRow[];

  const studentName = profile?.name || invite.student_name || invite.student_email;
  const studentEmail = profile?.email || invite.student_email;
  const cheatingScoreValue = normalizeCheatingScore(session?.cheating_score ?? null);
  const aiReport = (session?.ai_report ?? {}) as Record<string, any>;
  const aiScoreBreakdown = (aiReport.score_breakdown ?? {}) as Record<string, any>;

  const calculatedFlagScore = calculateFlagScore(flags);
  const calculatedPatternScore = calculatePatternScore(flags, behaviorLogs);
  const flagScore = typeof aiScoreBreakdown.flag_score === 'number' ? aiScoreBreakdown.flag_score : calculatedFlagScore.score;
  const patternScore = typeof aiScoreBreakdown.pattern_score === 'number'
    ? aiScoreBreakdown.pattern_score
    : calculatedPatternScore.score;
  const aiWritingScore = typeof aiScoreBreakdown.ai_writing_score === 'number'
    ? aiScoreBreakdown.ai_writing_score
    : 0;
  const finalScore = session
    ? Math.min(100, Math.round(flagScore * 0.4 + patternScore * 0.35 + aiWritingScore * 0.25))
    : 0;
  const displayedScore = session?.cheating_score != null ? cheatingScoreValue : finalScore;
  const riskLevel = displayedScore >= 71 ? 'Critical' : displayedScore >= 46 ? 'High' : displayedScore >= 21 ? 'Moderate' : 'Low';
  const showSessionData = Boolean(session);

  return (
    <div className="min-h-screen bg-gray-50">
      <TeacherNavbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href={`/teacher/exam/${id}/monitor`}>
              <Button variant="ghost" size="sm" className="px-0 text-gray-600 hover:text-gray-900">
                Back to Monitor
              </Button>
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">Student Detail</h1>
            <p className="mt-1 text-sm text-gray-600">Flags and cheating score breakdown for this student</p>
          </div>
          <Badge className={getRiskClass(displayedScore)}>{riskLevel} Risk</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-1">
            <h2 className="border-b pb-3 text-sm font-semibold uppercase text-gray-900">Student Info</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{studentName}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Email</p>
                <p className="text-gray-900">{studentEmail}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Status</p>
                <p className="text-gray-900">{session?.status ? formatLabel(session.status) : 'No session yet'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Submitted</p>
                <p className="text-gray-900">{session?.submitted_at ? new Date(session.submitted_at).toLocaleString() : 'Not submitted'}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cheating Score Calculation</h2>
                <p className="mt-1 text-sm text-gray-600">
                  cheating_score = min(100, round(flagScore × 0.40 + patternScore × 0.35 + aiWritingScore × 0.25))
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{displayedScore.toFixed(0)}%</p>
                <p className="text-xs text-gray-500">Current cheating score</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs uppercase text-gray-500">Flag Score</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{flagScore}</p>
                <p className="mt-1 text-xs text-gray-600">Sum of weighted flag severities</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs uppercase text-gray-500">Pattern Score</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{patternScore}</p>
                <p className="mt-1 text-xs text-gray-600">Tab bursts, face loss, paste, noise, speed anomalies</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs uppercase text-gray-500">AI Writing Score</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{aiWritingScore}</p>
                <p className="mt-1 text-xs text-gray-600">Gemini-based writing analysis</p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Weighting</p>
              <p className="mt-2">Flags: 40% | Pattern signals: 35% | AI writing: 25%</p>
              <p className="mt-1 text-xs text-gray-500">
                The score is stored as a 0-100 value, not multiplied by 100 again.
              </p>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Flag Breakdown</h2>
              <Badge className={getRiskClass(displayedScore)}>{flags.length} total</Badge>
            </div>

            {!showSessionData ? (
              <div className="mt-6 rounded bg-gray-50 p-6 text-center text-gray-500">
                No session has started yet, so there are no flags or score breakdowns to show.
              </div>
            ) : flags.length === 0 ? (
              <div className="mt-6 rounded bg-green-50 p-6 text-center text-green-800">
                No suspicious flags were recorded for this student.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {flags.map((flag) => (
                  <div key={flag.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{formatLabel(flag.flag_type)}</p>
                        <p className="mt-1 text-xs text-gray-600">{new Date(flag.created_at).toLocaleString()}</p>
                      </div>
                      <Badge
                        className={
                          flag.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : flag.severity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : flag.severity === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }
                      >
                        {flag.severity}
                      </Badge>
                    </div>

                    {flag.metadata && Object.keys(flag.metadata).length > 0 && (
                      <pre className="mt-3 overflow-x-auto rounded bg-white p-3 text-xs text-gray-600">
                        {JSON.stringify(flag.metadata, null, 2)}
                      </pre>
                    )}

                    {flag.screenshot_url && (
                      <a
                        href={flag.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View screenshot
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Calculation Details</h2>
              <Badge className={getRiskClass(displayedScore)}>{displayedScore.toFixed(0)}%</Badge>
            </div>

            <div className="mt-4 space-y-4 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900">Flag severity weights</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>Critical = 25 points</p>
                  <p>High = 15 points</p>
                  <p>Medium = 8 points</p>
                  <p>Low = 3 points</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-900">Computed pattern signals</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p>Tab burst score: {calculatedPatternScore.details.tabBurstScore}</p>
                  <p>Extended absence score: {calculatedPatternScore.details.extendedAbsenceScore}</p>
                  <p>Multiple faces score: {calculatedPatternScore.details.multipleFaceScore}</p>
                  <p>Copy/paste score: {calculatedPatternScore.details.pasteScore}</p>
                  <p>Noise lock score: {calculatedPatternScore.details.noiseLockScore}</p>
                  <p>Speed anomaly score: {calculatedPatternScore.details.speedAnomalyScore}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-900">Formula summary</p>
                <p className="mt-2 text-xs text-gray-600">
                  The backend calculates the composite score from the three weighted components and caps it at 100.
                  If the stored score is already present, that value is shown above.
                </p>
              </div>
            </div>

            {behaviorLogs.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-900">Behavior logs used in the calculation</p>
                <div className="mt-3 space-y-2">
                  {behaviorLogs.map((log) => (
                    <div key={log.id} className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900">{formatLabel(log.event_type)}</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-gray-500">Confidence: {(log.confidence * 100).toFixed(0)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}