'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flag as DBFlag } from '@/types/database';
import { generateFlagExplanation, groupFlagsBySeverity } from '@/lib/flag-explainer';

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

interface Flag extends DBFlag {
  session_id: string;
}

interface CollusionPair {
  student_a_id: string;
  student_a_name: string;
  student_b_id: string;
  student_b_name: string;
  question_id: string;
  question_text: string;
  similarity_percent: number;
  verdict: string;
  explanation: string;
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
  const [collusionResults, setCollusionResults] = useState<CollusionPair[] | null>(null);
  const [isCheckingCollusion, setIsCheckingCollusion] = useState(false);

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
  const normalizeCheatingScore = (score: number | null): number | null => {
    if (score == null) return null;
    return score <= 1 ? score * 100 : score;
  };
  const averageCheatingScore =
    sessionsWithCheatingScore.length > 0
      ? (
          sessionsWithCheatingScore.reduce(
            (sum, s) => sum + (normalizeCheatingScore(s.cheating_score) || 0),
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

  const handleRunCollusionCheck = async () => {
    try {
      setIsCheckingCollusion(true);
      const response = await fetch('/api/detect-collusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: exam.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to run collusion check');
      }

      const data = await response.json();
      setCollusionResults(data.flagged_pairs);
      toast.success(`Found ${data.flagged_pairs.length} potential collusion pair(s)`);
    } catch (error) {
      console.error('Collusion check error:', error);
      toast.error('Failed to run collusion check');
    } finally {
      setIsCheckingCollusion(false);
    }
  };

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
                        const cheatingScoreValue = normalizeCheatingScore(cheatingScore);
                        const passed =
                          score !== null &&
                          score !== undefined &&
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
                              {typeof cheatingScoreValue === 'number' ? (
                                <p
                                  className={`text-sm font-semibold ${
                                    cheatingScoreValue > 70
                                      ? 'text-red-600'
                                      : cheatingScoreValue > 40
                                      ? 'text-yellow-600'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {cheatingScoreValue.toFixed(0)}%
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
                    {typeof normalizeCheatingScore(selectedSession.cheating_score) ===
                      'number' && (
                      <div>
                        <p className="text-xs font-medium uppercase text-gray-600">
                          Cheating Score
                        </p>
                        {(() => {
                          const scoreValue = normalizeCheatingScore(selectedSession.cheating_score)!
                          return (
                        <p
                          className={`text-sm font-semibold ${
                            scoreValue > 70
                              ? 'text-red-600'
                              : scoreValue > 40
                                ? 'text-yellow-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {scoreValue.toFixed(0)}
                          %
                        </p>
                          )
                        })()}
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
                    Security Flags ({selectedFlags.length})
                  </h3>

                  {selectedFlags.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No flags raised
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Bar */}
                      <div className="grid grid-cols-4 gap-2 rounded bg-gray-50 p-3">
                        {[
                          { level: 'critical', label: 'Critical', color: 'text-red-600' },
                          { level: 'high', label: 'High', color: 'text-orange-600' },
                          { level: 'medium', label: 'Medium', color: 'text-yellow-600' },
                          { level: 'low', label: 'Low', color: 'text-blue-600' },
                        ].map(({ level, label, color }) => {
                          const count = selectedFlags.filter(
                            (f) => f.severity === level
                          ).length;
                          return (
                            <div key={level} className="text-center">
                              <p className={`text-sm font-bold ${color}`}>{count}</p>
                              <p className="text-xs text-gray-600">{label}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Grouped Flags */}
                      {groupFlagsBySeverity(
                        selectedFlags.map((flag) => generateFlagExplanation(flag))
                      ).critical.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase text-red-900">
                            Critical Flags
                          </h4>
                          {groupFlagsBySeverity(
                            selectedFlags.map((flag) => generateFlagExplanation(flag))
                          ).critical.map((explanation, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border-l-4 border-red-500 bg-red-50 p-3"
                            >
                              <div className="mb-1 flex items-start justify-between">
                                <span className="font-semibold text-red-900">
                                  {explanation.human_title}
                                </span>
                                <Badge variant="destructive" className="text-xs">
                                  CRITICAL
                                </Badge>
                              </div>
                              <p className="mb-2 text-sm text-red-800">
                                {explanation.human_description}
                              </p>
                              {explanation.evidence.length > 0 && (
                                <div className="mb-2 text-xs text-red-700">
                                  <p className="font-medium">Evidence:</p>
                                  <ul className="ml-4 list-disc space-y-1">
                                    {explanation.evidence.map((e, i) => (
                                      <li key={i}>{e}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <p className="rounded bg-red-100 p-2 text-xs text-red-900">
                                <strong>Action:</strong> {explanation.suggested_action}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {groupFlagsBySeverity(
                        selectedFlags.map((flag) => generateFlagExplanation(flag))
                      ).high.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase text-orange-900">
                            High Severity Flags
                          </h4>
                          {groupFlagsBySeverity(
                            selectedFlags.map((flag) => generateFlagExplanation(flag))
                          ).high.map((explanation, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border-l-4 border-orange-500 bg-orange-50 p-3"
                            >
                              <div className="mb-1 flex items-start justify-between">
                                <span className="font-semibold text-orange-900">
                                  {explanation.human_title}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="bg-orange-100 text-orange-900 text-xs"
                                >
                                  HIGH
                                </Badge>
                              </div>
                              <p className="mb-2 text-sm text-orange-800">
                                {explanation.human_description}
                              </p>
                              {explanation.evidence.length > 0 && (
                                <div className="mb-2 text-xs text-orange-700">
                                  <p className="font-medium">Evidence:</p>
                                  <ul className="ml-4 list-disc space-y-1">
                                    {explanation.evidence.map((e, i) => (
                                      <li key={i}>{e}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <p className="rounded bg-orange-100 p-2 text-xs text-orange-900">
                                <strong>Action:</strong> {explanation.suggested_action}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {groupFlagsBySeverity(
                        selectedFlags.map((flag) => generateFlagExplanation(flag))
                      ).medium.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase text-yellow-900">
                            Medium Severity Flags
                          </h4>
                          {groupFlagsBySeverity(
                            selectedFlags.map((flag) => generateFlagExplanation(flag))
                          ).medium.map((explanation, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-3"
                            >
                              <div className="mb-1 flex items-start justify-between">
                                <span className="font-semibold text-yellow-900">
                                  {explanation.human_title}
                                </span>
                                <Badge className="bg-yellow-100 text-yellow-900 text-xs">
                                  MEDIUM
                                </Badge>
                              </div>
                              <p className="mb-2 text-sm text-yellow-800">
                                {explanation.human_description}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {groupFlagsBySeverity(
                        selectedFlags.map((flag) => generateFlagExplanation(flag))
                      ).low.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase text-blue-900">
                            Low Severity Flags
                          </h4>
                          <div className="text-xs text-blue-700">
                            {
                              groupFlagsBySeverity(
                                selectedFlags.map((flag) => generateFlagExplanation(flag))
                              ).low.length
                            }{' '}
                            low-severity flag(s) detected — see details if needed.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* COLLUSION ANALYSIS Section */}
                <Card className="p-6">
                  <div className="mb-4 flex items-center justify-between border-b pb-4">
                    <h3 className="text-sm font-semibold uppercase text-gray-900">
                      Collusion Analysis
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunCollusionCheck}
                      disabled={isCheckingCollusion}
                    >
                      {isCheckingCollusion ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin">⟳</span>
                          Checking...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Run Collusion Check
                        </>
                      )}
                    </Button>
                  </div>

                  {!collusionResults && !isCheckingCollusion ? (
                    <div className="rounded bg-gray-50 p-6 text-center">
                      <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Click "Run Collusion Check" to analyze answer similarity across all students.
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Uses semantic embeddings to detect potentially copied or highly similar answers.
                      </p>
                    </div>
                  ) : isCheckingCollusion ? (
                    <div className="rounded bg-blue-50 p-6 text-center">
                      <div className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600">⟳</div>
                      <p className="text-sm text-blue-900">Analyzing answers for semantic similarity...</p>
                    </div>
                  ) : collusionResults && collusionResults.length === 0 ? (
                    <div className="rounded bg-green-50 p-6 text-center">
                      <p className="text-sm font-medium text-green-900">
                        ✓ No suspicious answer similarity detected
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr className="border-b">
                            <th className="px-3 py-2 text-left font-semibold text-gray-900">
                              Student A
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-900">
                              Student B
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-900">
                              Question
                            </th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-900">
                              Similarity
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-900">
                              Verdict
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {collusionResults?.map((pair, idx) => {
                            const similarityColor =
                              pair.similarity_percent >= 95
                                ? 'bg-red-100 text-red-900'
                                : pair.similarity_percent >= 85
                                  ? 'bg-orange-100 text-orange-900'
                                  : 'bg-yellow-100 text-yellow-900';

                            const verdictBadge =
                              pair.verdict === 'likely_copied'
                                ? 'bg-red-100 text-red-900'
                                : pair.verdict === 'highly_similar'
                                  ? 'bg-orange-100 text-orange-900'
                                  : 'bg-yellow-100 text-yellow-900';

                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {pair.student_a_name}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {pair.student_b_name}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <p className="truncate text-xs text-gray-600">
                                    {pair.question_text}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className={`inline-block rounded px-2 py-1 font-semibold ${similarityColor}`}>
                                    {pair.similarity_percent}%
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <div className={`inline-block rounded px-2 py-1 text-xs font-semibold ${verdictBadge}`}>
                                    {pair.verdict.replace(/_/g, ' ').toUpperCase()}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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
