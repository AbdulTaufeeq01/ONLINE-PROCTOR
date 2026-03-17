'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Invite {
  id: string;
  student_email: string;
  student_name: string;
  token: string;
  used: boolean;
}

interface ExamSession {
  id: string;
  student_id: string;
  invite_id: string;
  started_at: string;
  submitted_at: string | null;
  status: string;
  score: number | null;
  max_score: number | null;
  cheating_score: number | null;
}

interface Flag {
  id: string;
  session_id: string;
  student_id: string;
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
}

export default function ExamMonitor({
  exam,
  initialInvites,
  initialSessions,
  initialFlags,
}: ExamMonitorProps) {
  const [sessions, setSessions] = useState<ExamSession[]>(
    initialSessions ?? []
  );
  const [flags, setFlags] = useState<Flag[]>(
    initialFlags ?? []
  );
  const [invites, setInvites] = useState<Invite[]>(
    initialInvites ?? []
  );

  // Set up Supabase Realtime subscriptions
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Subscribe to exam_sessions changes
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
          if (payload.eventType === 'INSERT') {
            // Add new session to state
            setSessions((prev) => [...prev, payload.new as ExamSession]);
          }
          if (payload.eventType === 'UPDATE') {
            // Replace matching session in state
            setSessions((prev) =>
              prev.map((session) =>
                session.id === payload.new.id ? (payload.new as ExamSession) : session
              )
            );
          }
        }
      )
      .subscribe();

    // Subscribe to flags changes
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
          // Prepend new flag to state
          setFlags((prev) => [payload.new as Flag, ...prev]);
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      supabase.removeAllChannels();
    };
  }, [exam.id]);

  // Calculate stats
  const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;
  const submittedCount = sessions.filter((s) => s.status === 'submitted').length;

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/teacher/home" className="text-indigo-600 hover:text-indigo-700 font-medium mb-4 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900">{exam.title}</h1>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(exam.status)}`}>
            {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Invited */}
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Total Invited</p>
            <p className="text-3xl font-bold text-gray-900">{invites.length}</p>
          </div>
        </Card>

        {/* In Progress */}
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">In Progress</p>
            <p className="text-3xl font-bold text-blue-600">{inProgressCount}</p>
          </div>
        </Card>

        {/* Submitted */}
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Submitted</p>
            <p className="text-3xl font-bold text-green-600">{submittedCount}</p>
          </div>
        </Card>

        {/* Total Flags */}
        <Card className="p-6 border border-gray-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">Total Flags</p>
            <p className="text-3xl font-bold text-red-600">{flags.length}</p>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Student Status */}
        <div className="lg:col-span-2">
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
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Score</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Cheating Score</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Started At</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((invite) => {
                        // Find matching session
                        const session = sessions.find((s) => s.invite_id === invite.id);

                        // Derive student row data
                        const status = session?.status || 'not_started';
                        const score = session?.score;
                        const maxScore = session?.max_score;
                        const cheatingScore = session?.cheating_score;
                        const startedAt = session?.started_at;
                        const submittedAt = session?.submitted_at;

                        // Get status badge color
                        const getStatusBadgeColor = (s: string): string => {
                          switch (s) {
                            case 'in_progress':
                              return 'bg-blue-100 text-blue-800';
                            case 'submitted':
                              return 'bg-green-100 text-green-800';
                            case 'not_started':
                            default:
                              return 'bg-gray-100 text-gray-800';
                          }
                        };

                        // Format date helper
                        const formatDate = (dateString: string | null | undefined): string => {
                          if (!dateString) return '—';
                          const d = new Date(dateString);
                          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        };

                        return (
                          <tr key={invite.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            {/* Student Name + Email */}
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {invite.student_name || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-500">{invite.student_email}</div>
                            </td>

                            {/* Status Badge */}
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(status)}`}>
                                {status === 'not_started'
                                  ? 'Not Started'
                                  : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                              </span>
                            </td>

                            {/* Score */}
                            <td className="px-4 py-3 text-gray-700">
                              {score !== null && maxScore !== null ? `${score}/${maxScore}` : '—'}
                            </td>

                            {/* Cheating Score */}
                            <td className="px-4 py-3 text-gray-700">
                              {cheatingScore != null ? (
                                <span className={cheatingScore > 50 ? 'text-red-600 font-medium' : ''}>
                                  {typeof cheatingScore === 'number' ? cheatingScore.toFixed(1) + '%' : '—'}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            {/* Started At */}
                            <td className="px-4 py-3 text-gray-700 text-xs" suppressHydrationWarning>
                              {formatDate(startedAt)}
                            </td>

                            {/* Submitted At */}
                            <td className="px-4 py-3 text-gray-700 text-xs" suppressHydrationWarning>
                              {formatDate(submittedAt)}
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

        {/* Right Column: Recent Flags */}
        <div className="lg:col-span-1">
          <Card className="p-6 border border-gray-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Recent Flags</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                  {flags.length}
                </span>
              </div>

              {flags.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-center">No flags raised yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {flags.slice(0, 20).map((flag) => {
                    // Find matching session
                    const session = sessions.find((s) => s.id === flag.session_id);

                    // Find student name via invite
                    const studentName =
                      session && invites.find((inv) => inv.id === session.invite_id)
                        ? invites.find((inv) => inv.id === session.invite_id)?.student_name
                        : 'Unknown Student';

                    // Get border color based on severity
                    const getBorderColor = (severity: string): string => {
                      switch (severity.toLowerCase()) {
                        case 'low':
                          return 'border-l-4 border-l-yellow-500';
                        case 'medium':
                          return 'border-l-4 border-l-orange-500';
                        case 'high':
                          return 'border-l-4 border-l-red-500';
                        default:
                          return 'border-l-4 border-l-gray-500';
                      }
                    };

                    // Get severity badge color
                    const getSeverityBadgeColor = (severity: string): string => {
                      switch (severity.toLowerCase()) {
                        case 'low':
                          return 'bg-yellow-100 text-yellow-800';
                        case 'medium':
                          return 'bg-orange-100 text-orange-800';
                        case 'high':
                          return 'bg-red-100 text-red-800';
                        default:
                          return 'bg-gray-100 text-gray-800';
                      }
                    };

                    // Format flag type
                    const formatFlagType = (type: string): string => {
                      return type
                        .split('_')
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    };

                    // Format time
                    const formatTime = (dateString: string): string => {
                      try {
                        return new Date(dateString).toLocaleTimeString();
                      } catch {
                        return '—';
                      }
                    };

                    return (
                      <div
                        key={flag.id}
                        className={`p-3 bg-gray-50 rounded border ${getBorderColor(flag.severity)}`}
                      >
                        <div className="space-y-2">
                          {/* Flag Type + Severity Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-gray-900 text-sm">
                              {formatFlagType(flag.flag_type)}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getSeverityBadgeColor(flag.severity)}`}>
                              {flag.severity.charAt(0).toUpperCase() + flag.severity.slice(1)}
                            </span>
                          </div>

                          {/* Student Name + Time */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">{studentName}</span>
                            <span className="text-gray-500" suppressHydrationWarning>
                              {formatTime(flag.created_at)}
                            </span>
                          </div>

                          {/* Screenshot Thumbnail */}
                          {flag.screenshot_url && (
                            <div className="pt-1">
                              <a
                                href={flag.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block"
                              >
                                <img
                                  src={flag.screenshot_url}
                                  alt="Flag screenshot"
                                  className="h-16 w-16 object-cover rounded border border-gray-300 hover:opacity-80 transition-opacity cursor-pointer"
                                />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Show more indicator */}
                  {flags.length > 20 && (
                    <div className="pt-2 text-center text-xs text-gray-500">
                      And {flags.length - 20} more flag{flags.length - 20 !== 1 ? 's' : ''}...
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
