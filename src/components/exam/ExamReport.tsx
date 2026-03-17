'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Question {
  id: string;
  question_text: string;
  type: string;
  correct_answer: string;
  marks: number;
}

interface ExamSession {
  id: string;
  student_id: string;
  invite_id: string;
  started_at: string;
  submitted_at: string | null;
  status: string;
  answers: Record<string, string> | null;
  score: number | null;
  max_score: number | null;
  cheating_score: number | null;
  ai_report: string | null;
  grading_details: Record<string, any> | null;
}

interface ExamInvite {
  id: string;
  student_email: string;
  student_name: string;
  token: string;
  used: boolean;
}

interface Flag {
  id: string;
  session_id: string;
  flag_type: string;
  severity: string;
  screenshot_url: string | null;
  created_at: string;
}

interface Exam {
  id: string;
  title: string;
  status: string;
  duration_minutes: number;
  pass_marks: number;
}

interface Props {
  exam: Exam;
  questions?: Question[];
  initialSessions?: ExamSession[];
  initialInvites?: ExamInvite[];
  initialFlags?: Flag[];
}

export function ExamReport({
  exam,
  questions = [],
  initialSessions = [],
  initialInvites = [],
  initialFlags = [],
}: Props) {
  const [sessions] = useState<ExamSession[]>(initialSessions ?? []);
  const [invites] = useState<ExamInvite[]>(initialInvites ?? []);
  const [flags] = useState<Flag[]>(initialFlags ?? []);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Calculate statistics
  const totalStudents = invites.length;
  const completedSessions = sessions.filter(
    (s) => s.status === 'submitted'
  );
  const completedCount = completedSessions.length;

  const averageScore =
    completedSessions.length > 0
      ? (
          completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
          completedSessions.length
        ).toFixed(2)
      : '—';

  const sessionsWithCheatingScore = sessions.filter(
    (s) => s.cheating_score !== null
  );
  const averageCheatingScore =
    sessionsWithCheatingScore.length > 0
      ? (
          sessionsWithCheatingScore.reduce(
            (sum, s) => sum + (s.cheating_score || 0),
            0
          ) / sessionsWithCheatingScore.length
        ).toFixed(2)
      : '—';

  const selectedSession = selectedSessionId
    ? sessions.find((s) => s.id === selectedSessionId)
    : null;

  const selectedInvite = selectedSession
    ? invites.find((i) => i.id === selectedSession.invite_id)
    : null;

  const selectedFlags = selectedSession
    ? flags.filter((f) => f.session_id === selectedSession.id)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/teacher/home">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Summary Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6">
            <h3 className="mb-2 text-sm font-medium text-gray-600">
              Total Students
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {totalStudents}
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="mb-2 text-sm font-medium text-gray-600">
              Completed
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {completedCount}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {totalStudents > 0
                ? ((completedCount / totalStudents) * 100).toFixed(0)
                : 0}
              % completion
            </p>
          </Card>

          <Card className="p-6">
            <h3 className="mb-2 text-sm font-medium text-gray-600">
              Average Score
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {averageScore}
            </p>
            {completedSessions.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                out of {completedSessions[0]?.max_score || '—'}
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="mb-2 text-sm font-medium text-gray-600">
              Avg Cheating Score
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {averageCheatingScore}
            </p>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Students Table Section */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="mb-4 border-b pb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Students
                </h2>
              </div>

              {invites.length === 0 ? (
                <div className="rounded bg-gray-50 p-8 text-center text-gray-500">
                  <p>No students invited yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600">
                          Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600">
                          Cheating
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600">
                          Flags
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-600">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invites.map((invite) => {
                        const session = sessions.find(
                          (s) => s.invite_id === invite.id
                        );
                        const sessionFlags = session
                          ? flags.filter((f) => f.session_id === session.id)
                          : [];

                        const status = session?.status || 'not_started';
                        const score = session?.score;
                        const maxScore = session?.max_score;
                        const cheatingScore = session?.cheating_score;
                        const passed =
                          score !== null &&
                          maxScore !== null &&
                          score >= exam.pass_marks;

                        const isSelected =
                          selectedSessionId === session?.id;

                        return (
                          <tr
                            key={invite.id}
                            className={`${
                              isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                            } transition-colors`}
                          >
                            {/* Student Name & Email */}
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {invite.student_name || 'Unknown'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {invite.student_email}
                                </p>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  status === 'submitted'
                                    ? 'default'
                                    : status === 'in_progress'
                                      ? 'secondary'
                                      : 'outline'
                                }
                                className="w-fit text-xs"
                              >
                                {status === 'not_started'
                                  ? 'Not Started'
                                  : status === 'in_progress'
                                    ? 'In Progress'
                                    : 'Submitted'}
                              </Badge>
                            </td>

                            {/* Score */}
                            <td className="px-4 py-3">
                              {score !== null && maxScore !== null ? (
                                <p
                                  className={`text-sm font-semibold ${
                                    passed
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {score} / {maxScore}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-500">—</p>
                              )}
                            </td>

                            {/* Cheating Score */}
                            <td className="px-4 py-3">
                              {typeof cheatingScore === 'number' ? (
                                <p
                                  className={`text-sm font-semibold ${
                                    cheatingScore > 50
                                      ? 'text-red-600'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {cheatingScore.toFixed(1)}%
                                </p>
                              ) : (
                                <p className="text-sm text-gray-500">—</p>
                              )}
                            </td>

                            {/* Flags */}
                            <td className="px-4 py-3">
                              {sessionFlags.length > 0 ? (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  {sessionFlags.length}
                                </Badge>
                              ) : (
                                <p className="text-sm text-gray-500">—</p>
                              )}
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3">
                              {status === 'submitted' && session ? (
                                <Button
                                  variant={
                                    isSelected ? 'default' : 'outline'
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setSelectedSessionId(session.id)
                                  }
                                >
                                  View Details
                                </Button>
                              ) : (
                                <p className="text-xs text-gray-400">
                                  —
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Selected Student Detail Section */}
          <div className="lg:col-span-1">
            {!selectedSession || !selectedInvite ? (
              <Card className="p-6">
                <div className="rounded bg-gray-50 p-8 text-center text-gray-500">
                  <p>Select a student to view details</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* STUDENT INFO Section */}
                <Card className="p-6">
                  <h3 className="mb-4 border-b pb-4 text-sm font-semibold uppercase text-gray-900">
                    Student Info
                  </h3>

                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-600">
                        Name
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedInvite.student_name || 'Unknown'}
                      </p>
                    </div>

                    {/* Email */}
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-600">
                        Email
                      </p>
                      <p className="text-sm text-gray-900">
                        {selectedInvite.student_email}
                      </p>
                    </div>

                    {/* Started At */}
                    <div suppressHydrationWarning>
                      <p className="text-xs font-medium uppercase text-gray-600">
                        Started
                      </p>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedSession.started_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Submitted At */}
                    {selectedSession.submitted_at && (
                      <div suppressHydrationWarning>
                        <p className="text-xs font-medium uppercase text-gray-600">
                          Submitted
                        </p>
                        <p className="text-sm text-gray-900">
                          {new Date(selectedSession.submitted_at).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Score */}
                    {selectedSession.score !== null &&
                      selectedSession.max_score !== null && (
                        <div>
                          <p className="text-xs font-medium uppercase text-gray-600">
                            Score
                          </p>
                          <div className="mt-1 flex items-center gap-3">
                            <p className="text-lg font-bold text-gray-900">
                              {selectedSession.score} /{' '}
                              {selectedSession.max_score}
                            </p>
                            <Badge
                              variant={
                                selectedSession.score >=
                                exam.pass_marks
                                  ? 'default'
                                  : 'destructive'
                              }
                              className="text-xs"
                            >
                              {selectedSession.score >=
                              exam.pass_marks
                                ? 'Passed'
                                : 'Failed'}
                            </Badge>
                          </div>
                        </div>
                      )}

                    {/* Cheating Score */}
                    {typeof selectedSession.cheating_score ===
                      'number' && (
                      <div>
                        <p className="text-xs font-medium uppercase text-gray-600">
                          Cheating Score
                        </p>
                        <p
                          className={`text-sm font-semibold ${
                            selectedSession.cheating_score > 50
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {selectedSession.cheating_score.toFixed(
                            1
                          )}
                          %
                        </p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* AI REPORT Section */}
                <Card className="p-6">
                  <h3 className="mb-4 border-b pb-4 text-sm font-semibold uppercase text-gray-900">
                    AI Report
                  </h3>

                  {selectedSession.ai_report ? (
                    <pre className="overflow-auto rounded bg-gray-50 p-4 text-xs text-gray-700">
                      {selectedSession.ai_report}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Not graded yet
                    </p>
                  )}
                </Card>

                {/* FLAGS Section */}
                <Card className="p-6">
                  <h3 className="mb-4 border-b pb-4 text-sm font-semibold uppercase text-gray-900">
                    Flags ({selectedFlags.length})
                  </h3>

                  {selectedFlags.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No flags raised
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedFlags.map((flag) => {
                        const severityStyles = {
                          low: 'bg-yellow-50 border-yellow-200',
                          medium: 'bg-orange-50 border-orange-200',
                          high: 'bg-red-50 border-red-200',
                        };

                        const severityTextStyles = {
                          low: 'text-yellow-900',
                          medium: 'text-orange-900',
                          high: 'text-red-900',
                        };

                        const severityBadgeVariant = {
                          low: 'outline',
                          medium: 'secondary',
                          high: 'destructive',
                        } as const;

                        const style =
                          severityStyles[
                            flag.severity as
                              | 'low'
                              | 'medium'
                              | 'high'
                          ] || severityStyles.medium;

                        const textStyle =
                          severityTextStyles[
                            flag.severity as
                              | 'low'
                              | 'medium'
                              | 'high'
                          ] || severityTextStyles.medium;

                        const badgeVariant =
                          severityBadgeVariant[
                            flag.severity as
                              | 'low'
                              | 'medium'
                              | 'high'
                          ] || 'secondary';

                        return (
                          <div
                            key={flag.id}
                            className={`rounded border p-3 ${style}`}
                          >
                            <div className="mb-2 flex items-start justify-between">
                              <span
                                className={`text-xs font-semibold ${textStyle}`}
                              >
                                {flag.flag_type
                                  .replace(/_/g, ' ')
                                  .toUpperCase()}
                              </span>
                              <Badge
                                variant={badgeVariant}
                                className="text-xs capitalize"
                              >
                                {flag.severity}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div suppressHydrationWarning>
                                <p className="text-xs text-gray-600">
                                  {new Date(
                                    flag.created_at
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                              {flag.screenshot_url && (
                                <a
                                  href={flag.screenshot_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                                >
                                  Screenshot
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* ANSWERS Section */}
                <Card className="p-6">
                  <h3 className="mb-4 border-b pb-4 text-sm font-semibold uppercase text-gray-900">
                    Answers
                  </h3>

                  {!selectedSession.answers ? (
                    <p className="text-sm text-gray-500">
                      No answers
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {questions.map((question) => {
                        const studentAnswer =
                          selectedSession.answers?.[
                            question.id
                          ] || null;
                        const isCorrect =
                          studentAnswer ===
                          question.correct_answer;

                        return (
                          <div
                            key={question.id}
                            className="border-b pb-4 last:border-b-0"
                          >
                            {/* Question */}
                            <p className="mb-2 text-sm font-medium text-gray-900">
                              {question.question_text}
                            </p>

                            {/* Student Answer */}
                            <div className="mb-2">
                              <p className="text-xs font-medium uppercase text-gray-600">
                                Student Answer
                              </p>
                              <p
                                className={`text-sm ${
                                  studentAnswer
                                    ? isCorrect
                                      ? 'font-semibold text-green-600'
                                      : 'text-gray-900'
                                    : 'text-gray-500'
                                }`}
                              >
                                {studentAnswer || 'No answer'}
                              </p>
                            </div>

                            {/* Correct Answer */}
                            <div className="mb-2">
                              <p className="text-xs font-medium uppercase text-gray-600">
                                Correct Answer
                              </p>
                              <p className="text-sm font-semibold text-green-600">
                                {question.correct_answer}
                              </p>
                            </div>

                            {/* Marks */}
                            <p className="text-xs text-gray-600">
                              Marks: {question.marks}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
