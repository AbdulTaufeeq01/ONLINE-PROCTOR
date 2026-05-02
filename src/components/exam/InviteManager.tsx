'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface Invite {
  id: string;
  student_email: string;
  student_name: string | null;
  token: string;
  used: boolean;
  created_at: string;
}

interface ExamInviteManagerProps {
  exam: { id: string; title: string; status: string };
  invites: Invite[];
}

export default function InviteManager({
  exam,
  invites: initialInvites,
}: ExamInviteManagerProps) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [emailInput, setEmailInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  };

  const handleCopyLink = async (invite: Invite) => {
    const link = `${process.env.NEXT_PUBLIC_APP_URL}/join/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyingId(invite.id);
      setTimeout(() => setCopyingId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Use regex split so no string literal newline can be broken by formatters
  const parseStudents = (
    input: string
  ): { email: string; name: string | null }[] => {
    return input
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const parts = trimmed.split(',');
        const email = parts[0].trim();
        const name = parts.length > 1 ? parts[1].trim() || null : null;

        return { email, name };
      })
      .filter(
        (entry): entry is { email: string; name: string | null } =>
          entry !== null
      );
  };

  const handleSendInvites = async () => {
    setError(null);
    setSuccessCount(null);

    const students = parseStudents(emailInput);
    if (students.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    // Check for duplicates in input
    const emailsInInput = students.map((s) => s.email.toLowerCase());
    const seen = new Set<string>();
    for (const email of emailsInInput) {
      if (seen.has(email)) {
        setError(`Duplicate email: ${email}`);
        return;
      }
      seen.add(email);
    }

    // Check against already-sent invites
    const existingEmails = new Set(
      invites.map((inv) => inv.student_email.toLowerCase())
    );
    for (const student of students) {
      if (existingEmails.has(student.email.toLowerCase())) {
        setError(`Invite already sent to: ${student.email}`);
        return;
      }
    }

    // Validate email format
    const invalidEmails = students.filter((s) => !validateEmail(s.email));
    if (invalidEmails.length > 0) {
      setError(
        `Invalid email addresses: ${invalidEmails.map((s) => s.email).join(', ')}`
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/send-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: exam.id, students }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invites');
      }

      setInvites([...invites, ...data.invites]);
      setSuccessCount(students.length);
      setEmailInput('');
      setTimeout(() => setSuccessCount(null), 5000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
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
        <h1 className="text-4xl font-bold text-gray-900">
          Invite Students — {exam.title}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form */}
        <div className="lg:col-span-1">
          <Card className="p-6 border border-gray-200">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Send Invites</h2>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {successCount !== null && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-700">
                    Successfully sent {successCount} invite
                    {successCount !== 1 ? 's' : ''}!
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="emails"
                  className="text-sm font-semibold text-gray-700"
                >
                  Student Emails
                </Label>
                <Textarea
                  id="emails"
                  placeholder={
                    'Enter emails, one per line:\njohn@example.com\njane@example.com, Jane Smith'
                  }
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={isLoading}
                  className="w-full min-h-48 text-sm"
                />
                <p className="text-xs text-gray-500">
                  Optionally add a name after a comma: john@example.com, John
                  Smith
                </p>
              </div>

              <Button
                onClick={handleSendInvites}
                disabled={isLoading || emailInput.trim().length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md"
              >
                {isLoading ? 'Sending...' : 'Send Invites'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: Invites Table */}
        <div className="lg:col-span-2">
          <Card className="p-6 border border-gray-200">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">
                Sent Invites ({invites.length})
              </h2>

              {invites.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 text-center">
                    No invites sent yet
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    Invite links are single-use and expire once used
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Join Link
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Copy
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Sent At
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {invites.map((invite) => (
                          <tr
                            key={invite.id}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-gray-900">
                              {invite.student_name || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {invite.student_email}
                            </td>
                            <td className="px-4 py-3">
                              <a
                                href={`${process.env.NEXT_PUBLIC_APP_URL}/join/${invite.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline text-xs truncate inline-block max-w-xs"
                              >
                                /join/{invite.token.slice(0, 8)}...
                              </a>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                onClick={() => handleCopyLink(invite)}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                {copyingId === invite.id ? 'Copied!' : 'Copy Link'}
                              </Button>
                            </td>
                            <td className="px-4 py-3">
                              {invite.used ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Used
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td
                              className="px-4 py-3 text-gray-700 text-xs"
                              suppressHydrationWarning
                            >
                              {(() => {
                                const d = new Date(invite.created_at);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}