'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface FlaggedPair {
  student_a_id: string
  student_a_name: string
  student_b_id: string
  student_b_name: string
  question_id: string
  question_text: string
  similarity_percent: number
  similarity_verdict: 'unique' | 'similar' | 'highly_similar' | 'likely_copied'
  verdict: string
  explanation: string
  final_risk_score?: number
  risk_level?: string
  teacher_verdict?: string
}

interface CollisionReportProps {
  examId: string
  sessionReports?: any[]
  onClose?: () => void
}

export function CollisionReport({
  examId,
  sessionReports = [],
  onClose,
}: CollisionReportProps) {
  const [flaggedPairs, setFlaggedPairs] = useState<FlaggedPair[]>([])
  const [loading, setLoading] = useState(false)
  const [filterRisk, setFilterRisk] = useState<string>('all') // all, flagged, high, critical
  const [expandedPair, setExpandedPair] = useState<string | null>(null)

  useEffect(() => {
    // If collusion data is passed in, use it; otherwise leave empty
    if (sessionReports && sessionReports.length > 0) {
      const pairs: FlaggedPair[] = []
      // Extract flagged pairs from session reports
      sessionReports.forEach((report: any) => {
        if (report.collusion_flags?.length > 0) {
          pairs.push(...report.collusion_flags)
        }
      })
      setFlaggedPairs(pairs)
    }
  }, [sessionReports])

  const filteredPairs = flaggedPairs.filter((pair) => {
    if (filterRisk === 'all') return true
    if (filterRisk === 'flagged') return (pair.final_risk_score ?? 0) >= 55
    if (filterRisk === 'high') return (pair.final_risk_score ?? 0) >= 70
    if (filterRisk === 'critical') return (pair.final_risk_score ?? 0) >= 85
    return true
  })

  const getRiskColor = (similarity: number) => {
    if (similarity >= 95) return 'bg-red-100 text-red-800'
    if (similarity >= 85) return 'bg-orange-100 text-orange-800'
    if (similarity >= 70) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getRiskBadge = (similarity: number) => {
    if (similarity >= 95) return 'CRITICAL'
    if (similarity >= 85) return 'HIGH'
    if (similarity >= 70) return 'MEDIUM'
    return 'LOW'
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Collusion Detection Report</h2>
          <p className="text-sm text-gray-600 mt-1">
            Analyzing answer similarity across all submissions
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Summary Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">Total Pairs Checked</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{flaggedPairs.length}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Flagged for Review</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {flaggedPairs.filter((p) => (p.final_risk_score ?? 0) >= 55).length}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600">Critical Risk</p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {flaggedPairs.filter((p) => (p.final_risk_score ?? 0) >= 85).length}
            </p>
          </div>
        </div>
      </Card>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'All Pairs' },
          { value: 'flagged', label: 'Flagged (≥55%)' },
          { value: 'high', label: 'High (≥70%)' },
          { value: 'critical', label: 'Critical (≥85%)' },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => setFilterRisk(filter.value)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filterRisk === filter.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Flagged Pairs Table */}
      <div className="space-y-4">
        {filteredPairs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-600">
              {filterRisk === 'all'
                ? 'No pairs analyzed yet'
                : `No pairs found in the ${filterRisk} risk category`}
            </p>
          </Card>
        ) : (
          filteredPairs.map((pair, idx) => {
            const pairId = `${pair.student_a_id}-${pair.student_b_id}`
            const isExpanded = expandedPair === pairId
            const similarity = pair.similarity_percent || 0

            return (
              <Card
                key={idx}
                className={`p-4 border-l-4 cursor-pointer transition ${
                  similarity >= 85
                    ? 'border-l-red-500 bg-red-50'
                    : similarity >= 70
                      ? 'border-l-yellow-500 bg-yellow-50'
                      : similarity >= 55
                        ? 'border-l-orange-500 bg-orange-50'
                        : 'border-l-green-500 bg-green-50'
                }`}
                onClick={() =>
                  setExpandedPair(isExpanded ? null : pairId)
                }
              >
                {/* Summary Row */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Badge className={getRiskColor(similarity)}>
                        {getRiskBadge(similarity)}
                      </Badge>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {pair.student_a_name} ↔ {pair.student_b_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Q: {pair.question_text?.substring(0, 50)}...
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {similarity}%
                    </p>
                    <p className="text-xs text-gray-600">similarity</p>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                    {/* Verdict & Explanation */}
                    <div>
                      <p className="font-semibold text-gray-900 mb-2">Analysis:</p>
                      <p className="text-sm text-gray-700">{pair.teacher_verdict || pair.explanation}</p>
                    </div>

                    {/* Side-by-side Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 mb-2">
                          {pair.student_a_name}'s Answer
                        </p>
                        <div className="bg-gray-100 p-3 rounded text-sm text-gray-700 max-h-40 overflow-y-auto">
                          {/* Answers would need to be fetched separately */}
                          <span className="italic text-gray-500">
                            (Answer content not shown in summary)
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 mb-2">
                          {pair.student_b_name}'s Answer
                        </p>
                        <div className="bg-gray-100 p-3 rounded text-sm text-gray-700 max-h-40 overflow-y-auto">
                          <span className="italic text-gray-500">
                            (Answer content not shown in summary)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4">
                      <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition">
                        Review Detailed
                      </button>
                      <button className="flex-1 px-4 py-2 bg-gray-600 text-white rounded font-medium hover:bg-gray-700 transition">
                        Mark Reviewed
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* Footer Notes */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Similarity scores are calculated using semantic embeddings.
          Scores ≥85% indicate likely collusion and should be escalated for review.
          Scores 55-70% indicate possible similarity but may be legitimate independent derivation.
        </p>
      </Card>
    </div>
  )
}
