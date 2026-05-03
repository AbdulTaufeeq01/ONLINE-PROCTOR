'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Flag {
  id: string;
  flag_type: string;
  severity: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentEmail: string;
  cheatingScore: number | null;
  flags: Flag[];
  score: number | null;
  maxScore: number | null;
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  multiple_faces: 'Multiple faces detected in frame - possible unauthorized person present',
  no_face: 'Face detection lost - student may have stepped away or hidden face',
  copy_paste: 'Clipboard paste activity detected - possible external content insertion',
  tab_switch: 'Student switched to another browser tab - possible external resource access',
  fullscreen_exit: 'Exam exited fullscreen mode - possible minimization or tab switching',
  window_blur: 'Exam window lost focus - possible attention to other application',
  noise_exam_locked: 'Exam locked due to excessive noise detection',
  eye_away: 'Eyes detected looking away from screen - possible reference material consultation',
  phone_suspected: 'Phone or additional device suspected in frame',
  copy_attempt: 'Copy command attempted (Ctrl+C/Cmd+C)',
};

const getSeverityColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getRiskLevel = (score: number | null): { level: string; color: string; description: string } => {
  if (score === null || score === undefined) return { level: 'Unknown', color: 'bg-gray-100 text-gray-800', description: 'No data' };
  if (score >= 71) return { level: 'Critical', color: 'bg-red-100 text-red-800', description: 'High suspicion of cheating' };
  if (score >= 46) return { level: 'High', color: 'bg-orange-100 text-orange-800', description: 'Multiple suspicious indicators' };
  if (score >= 21) return { level: 'Moderate', color: 'bg-yellow-100 text-yellow-800', description: 'Some concerning patterns' };
  return { level: 'Low', color: 'bg-green-100 text-green-800', description: 'Minimal suspicious activity' };
};

export function StudentDetailModal({
  isOpen,
  onClose,
  studentName,
  studentEmail,
  cheatingScore,
  flags,
  score,
  maxScore,
}: StudentDetailModalProps) {
  if (!isOpen) return null;

  const riskInfo = getRiskLevel(cheatingScore);
  const scorePercent = maxScore ? Math.round((score / maxScore) * 100) : 0;

  const flagsByType = flags.reduce((acc, flag) => {
    if (!acc[flag.flag_type]) acc[flag.flag_type] = [];
    acc[flag.flag_type].push(flag);
    return acc;
  }, {} as Record<string, Flag[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-end pt-16">
      <div className="bg-white w-96 h-[calc(100vh-64px)] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Student Details</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Student Info */}
          <div>
            <p className="text-sm font-medium text-gray-600">Name</p>
            <p className="text-lg font-semibold text-gray-900">{studentName}</p>
            <p className="text-sm text-gray-600">{studentEmail}</p>
          </div>

          {/* Score Card */}
          {score !== null && maxScore !== null && (
            <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
              <p className="text-sm font-medium text-gray-600 mb-2">Academic Score</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {score}/{maxScore}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{scorePercent}%</p>
                </div>
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                  <div className="relative w-14 h-14">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="3"
                        strokeDasharray={`${scorePercent * 2.827} 282.7`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">
                      {scorePercent}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Cheating Score Card */}
          {cheatingScore !== null && (
            <Card className={`p-4 ${riskInfo.color}`}>
              <p className="text-sm font-medium mb-2 opacity-80">Cheating Risk Score</p>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold">{cheatingScore.toFixed(0)}%</span>
                    <Badge className={riskInfo.color}>{riskInfo.level}</Badge>
                  </div>
                  <p className="text-sm opacity-80">{riskInfo.description}</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-white bg-opacity-30 rounded-full h-3">
                  <div
                    className="bg-current h-3 rounded-full transition-all"
                    style={{ width: `${cheatingScore}%` }}
                  />
                </div>

                {/* Risk Scale */}
                <div className="text-xs mt-4 space-y-1 opacity-80">
                  <div className="flex justify-between">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1 h-1 bg-green-500 opacity-30"></div>
                    <div className="flex-1 h-1 bg-yellow-500 opacity-30"></div>
                    <div className="flex-1 h-1 bg-red-500 opacity-30"></div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Flags Section */}
          {flags.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Suspicious Flags ({flags.length})
              </p>
              <div className="space-y-3">
                {Object.entries(flagsByType).map(([flagType, typedFlags]) => (
                  <div key={flagType}>
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-600 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900 text-sm">
                            {flagType.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          <Badge className="bg-orange-100 text-orange-800 text-xs">
                            ×{typedFlags.length}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {FLAG_DESCRIPTIONS[flagType] || 'Suspicious activity detected'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          First occurrence: {new Date(typedFlags[0].created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Card className="p-4 bg-green-50 border-green-200">
              <p className="text-sm text-green-800">✓ No suspicious flags detected</p>
            </Card>
          )}

          {/* Recommendations */}
          {cheatingScore && cheatingScore > 50 && (
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <p className="text-sm font-semibold text-yellow-900 mb-2">Recommended Action</p>
              <ul className="text-xs text-yellow-800 space-y-1">
                <li>• Review submitted answers for unusual similarities</li>
                <li>• Check if behavioral patterns align with flagged activities</li>
                <li>• Consider requiring oral exam or follow-up assessment</li>
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
