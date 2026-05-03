'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TrendingUp, X } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Invite {
  id: string;
  student_email: string;
  student_name: string;
  token: string;
  used: boolean;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface ExamSession {
  id: string;
  student_id: string | null;
  invite_id: string;
  started_at: string | null;
  submitted_at: string | null;
  status: string;
  score: number | null;
  max_score: number | null;
  cheating_score: number | null;
  answers: Record<string, unknown> | null;
}

interface Flag {
  id: string;
  session_id: string;
  student_id: string | null;
  flag_type: string;
  severity: string;
  screenshot_url: string | null;
  created_at: string;
}

interface ExamMonitorProps {
  exam: { id: string; title: string; status: string };
  initialInvites: Invite[];
  initialSessions: ExamSession[];
  initialFlags: Flag[];
  initialProfiles: Profile[];
  totalQuestions: number;
}

export default function ExamMonitor({
  exam,
  initialInvites,
  initialSessions,
  initialProfiles,
  initialFlags,
  totalQuestions,
}: ExamMonitorProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ExamSession[]>(initialSessions ?? []);
  const [flags, setFlags] = useState<Flag[]>(initialFlags ?? []);
  const [invites, setInvites] = useState<Invite[]>(initialInvites ?? []);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles ?? []);
  const [now, setNow] = useState(new Date());
  const [isLive, setIsLive] = useState(true);
  const [isCollusionLoading, setIsCollusionLoading] = useState(false);
  const [collusionResults, setCollusionResults] = useState<any[] | null>(null);
  const [showCollusionModal, setShowCollusionModal] = useState(false);

  // Update time every second for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Set up Supabase Real-time subscriptions
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const sessionsChannel = supabase
      .channel(`sessions-${exam.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'exam_sessions',
          filter: `exam_id=eq.${exam.id}`,
        },
        (payload) => {
          setIsLive(false);
          setTimeout(() => setIsLive(true), 2000);
          if (payload.eventType === 'INSERT') {
            setSessions((prev) => [...prev, payload.new as ExamSession]);
          }
          if (payload.eventType === 'UPDATE') {
            setSessions((prev) =>
              prev.map((session) =>
                session.id === payload.new.id ? (payload.new as ExamSession) : session
              )
            );
          }
        }
      )
      .subscribe();

    const flagsChannel = supabase
      .channel(`flags-${exam.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'flags',
          filter: `exam_id=eq.${exam.id}`,
        },
        (payload) => {
          setIsLive(false);
          setTimeout(() => setIsLive(true), 2000);
          setFlags((prev) => [payload.new as Flag, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeAllChannels();
    };
  }, [exam.id]);

  const getStudentName = (session: ExamSession | undefined, invite: Invite): string => {
    if (!session) return invite.student_name || invite.student_email;
    const profile = profiles.find((p) => p.id === session.student_id);
    return profile?.name || invite.student_name || invite.student_email;
  };

  const getAnsweredQuestions = (session: ExamSession | undefined): number => {
    if (!session || !session.answers) return 0;
    const answers = session.answers as Record<string, unknown>;
    return Object.keys(answers).filter((key) => answers[key] !== null && answers[key] !== '').length;
  };

  const calculateTimeElapsed = (
    startedAt: string | null,
    endedAt: string | null = null
  ): string => {
    if (!startedAt) return '—';
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : now;
    const diff = end.getTime() - start.getTime();
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const getFlagCount = (sessionId: string): number =>
    flags.filter((f) => f.session_id === sessionId).length;

  const formatType = (type: string): string =>
    type.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  const formatTime = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const getSeverityBadgeColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'low':      return 'bg-yellow-100 text-yellow-800';
      case 'medium':   return 'bg-orange-100 text-orange-800';
      case 'high':     return 'bg-red-100 text-red-800';
      case 'critical': return 'bg-purple-100 text-purple-800';
      default:         return 'bg-gray-100 text-gray-800';
    }
  };

  const getBorderColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'low':      return 'border-l-4 border-l-yellow-500';
      case 'medium':   return 'border-l-4 border-l-orange-500';
      case 'high':     return 'border-l-4 border-l-red-500';
      case 'critical': return 'border-l-4 border-l-purple-500';
      default:         return 'border-l-4 border-l-gray-500';
    }
  };

  const getSessionStatusColor = (status: string): string => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'submitted':   return 'bg-green-100 text-green-800';
      default:            return 'bg-gray-100 text-gray-800';
    }
  };

  const getExamStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft':  return 'bg-gray-100 text-gray-800';
      case 'ended':  return 'bg-red-100 text-red-800';
      default:       return 'bg-blue-100 text-blue-800';
    }
  };

  const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;
  const submittedCount  = sessions.filter((s) => s.status === 'submitted').length;
  const highRiskCount   = sessions.filter((s) => {
    const score = typeof s.cheating_score === 'number'
      ? (s.cheating_score <= 1 ? s.cheating_score * 100 : s.cheating_score)
      : null;
    return score != null && score > 70;
  }).length;

  const openStudentDetails = (inviteId: string) => {
    router.push(`/teacher/exam/${exam.id}/student/${inviteId}`);
  };

  const handleRunCollusion = async () => {
    try {
      setIsCollusionLoading(true);
      const res = await fetch('/api/detect-collusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: exam.id }),
      });
      if (!res.ok) throw new Error('Failed to run collusion detection');
      const data = await res.json();
      setCollusionResults(data.flagged_pairs || []);
      setShowCollusionModal(true);
      toast.success(`Found ${data.flagged_pairs?.length || 0} potential collusion pairs`);
    } catch (err) {
      console.error('Collusion detection error:', err);
      toast.error('Failed to run collusion detection');
    } finally {
      setIsCollusionLoading(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/teacher/home"
          className="text-indigo-600 hover:text-indigo-700 font-medium mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{exam.title}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Total Questions: <span className="font-semibold">{totalQuestions}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleRunCollusion}
              disabled={isCollusionLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              {isCollusionLoading ? 'Analyzing...' : 'Run Collusion Check'}
            </Button>
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}
              />
              <span className="text-sm font-medium text-gray-700">
                {isLive ? 'Live' : 'Updating...'}
              </span>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getExamStatusColor(exam.status)}`}
            >
              {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Total Invited</p>
            <p className="text-3xl font-bold text-gray-900">{invites.length}</p>
          </div>
        </Card>
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">In Progress</p>
            <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
          </div>
        </Card>
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Submitted</p>
            <p className="text-3xl font-bold text-green-600">{submittedCount}</p>
          </div>
        </Card>
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">High Risk</p>
            <p className="text-3xl font-bold text-red-600">{highRiskCount}</p>
          </div>
        </Card>
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Total Flags</p>
            <p className="text-3xl font-bold text-orange-600">{flags.length}</p>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="p-6 border border-gray-200">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Student Status</h2>

            {invites.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 text-center">No students invited yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Student</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Progress</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Time</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Score</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Risk</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Flags</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Answers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => {
                      const session = sessions.find((s) => s.invite_id === invite.id);
                      const status = session?.status || 'not_started';
                      const answeredQuestions = getAnsweredQuestions(session);
                      const progressPercent =
                        totalQuestions > 0
                          ? Math.round((answeredQuestions / totalQuestions) * 100)
                          : 0;
                      const flagCount = session ? getFlagCount(session.id) : 0;
                      const cheatingScoreValue =
                        typeof session?.cheating_score === 'number'
                          ? (session.cheating_score <= 1
                              ? session.cheating_score * 100
                              : session.cheating_score)
                          : null;

                      return (
                        <tr
                          key={invite.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openStudentDetails(invite.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openStudentDetails(invite.id);
                            }
                          }}
                          className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 focus:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {getStudentName(session, invite)}
                            </div>
                            <div className="text-xs text-gray-500">{invite.student_email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSessionStatusColor(status)}`}
                            >
                              {status === 'not_started'
                                ? 'Not Started'
                                : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                                {answeredQuestions}/{totalQuestions}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                            {calculateTimeElapsed(
                              session?.started_at ?? null,
                              session?.submitted_at ?? null
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {session?.score != null && session?.max_score != null
                              ? `${session.score}/${session.max_score}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {cheatingScoreValue != null ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  cheatingScoreValue > 70
                                    ? 'bg-red-100 text-red-800'
                                    : cheatingScoreValue > 40
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {cheatingScoreValue.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {flagCount > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                {flagCount}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openStudentDetails(invite.id);
                              }}
                            >
                              View Details
                            </Button>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/teacher/exam/${exam.id}/review/${invite.id}`);
                              }}
                            >
                              Review Answers
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

      </div>

      {/* Collusion Detection Section */}
      <div className="mt-8">
        <Card className="p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Collusion Detection</h2>
              <p className="text-sm text-gray-600 mt-1">Analyze answers for suspicious similarity</p>
            </div>
            <Button
              onClick={handleRunCollusion}
              disabled={isCollusionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isCollusionLoading ? 'Analyzing...' : 'Run Collusion Check'}
            </Button>
          </div>

          {collusionResults === null ? (
            <div className="text-center py-8 text-gray-500">
              <p>Click "Run Collusion Check" to analyze answers for unusual similarity</p>
            </div>
          ) : collusionResults.length === 0 ? (
            <div className="text-center py-8 bg-green-50 rounded border border-green-200">
              <p className="text-green-800">✓ No suspicious answer similarity detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collusionResults.map((pair, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded border-l-4 ${
                    pair.similarity_percent >= 85
                      ? 'border-l-red-500 bg-red-50'
                      : pair.similarity_percent >= 70
                      ? 'border-l-orange-500 bg-orange-50'
                      : 'border-l-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {pair.student_a_name} ↔ {pair.student_b_name}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Q: {pair.question_text?.substring(0, 60)}...
                      </p>
                      <p className="text-xs text-gray-500 mt-2">{pair.explanation}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {pair.similarity_percent}%
                      </div>
                      <div
                        className={`text-xs font-semibold mt-1 px-2 py-1 rounded ${
                          pair.similarity_percent >= 85
                            ? 'bg-red-200 text-red-800'
                            : pair.similarity_percent >= 70
                            ? 'bg-orange-200 text-orange-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}
                      >
                        {pair.similarity_percent >= 85
                          ? 'CRITICAL'
                          : pair.similarity_percent >= 70
                          ? 'HIGH'
                          : 'MEDIUM'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Collusion Results Modal */}
      {showCollusionModal && collusionResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Collusion Detection Results</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Found {collusionResults.length} potential collusion pairs
                </p>
              </div>
              <button
                onClick={() => setShowCollusionModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {collusionResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No collusion detected</p>
                </div>
              ) : (
                collusionResults.map((pair, idx) => {
                  const similarity = pair.similarity_percent || 0;
                  const getSimilarityColor = (percent: number) => {
                    if (percent >= 85) return 'bg-red-50 border-red-200';
                    if (percent >= 70) return 'bg-orange-50 border-orange-200';
                    return 'bg-yellow-50 border-yellow-200';
                  };

                  const getSimilarityBadgeColor = (percent: number) => {
                    if (percent >= 85) return 'bg-red-100 text-red-800';
                    if (percent >= 70) return 'bg-orange-100 text-orange-800';
                    return 'bg-yellow-100 text-yellow-800';
                  };

                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 ${getSimilarityColor(similarity)}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {pair.student_a || 'Student A'} ↔ {pair.student_b || 'Student B'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Question {pair.question_number || 'N/A'}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSimilarityBadgeColor(similarity)}`}>
                          {similarity.toFixed(1)}% Similar
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-700">Verdict: {pair.verdict || 'Similar'}</p>
                        </div>
                        {pair.explanation && (
                          <p className="text-gray-600 italic">{pair.explanation}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-6 flex justify-end gap-3">
              <Button
                onClick={() => setShowCollusionModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}