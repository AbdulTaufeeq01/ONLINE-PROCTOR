/**
 * Flag Explainer: Convert raw flag data into human-readable explanations
 * 
 * Maps all flag_types to explanations that teachers can understand.
 */

import { Flag } from '@/types/database';

export interface FlagExplanation {
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  human_title: string;
  human_description: string;
  evidence: string[];
  suggested_action: string;
  confidence_label: string;
  timestamp: string;
}

/**
 * Generate human-readable explanation for a flag
 * @param flag - Flag record from database
 * @returns FlagExplanation object with human-readable content
 */
export function generateFlagExplanation(flag: Flag): FlagExplanation {
  const metadata = (flag.metadata || {}) as Record<string, unknown>;
  const confidence = (metadata.confidence as number) || 0;
  const duration_seconds = (metadata.duration_seconds as number) || 0;
  const student_b_name = (metadata.student_b_name as string) || 'Another student';
  const similarity_percent = (metadata.similarity_percent as number) || 0;
  const similarity_percent_label = similarity_percent !== undefined ? `${similarity_percent}%` : 'Unknown';

  const baseExplanation: FlagExplanation = {
    flag_type: flag.flag_type,
    severity: flag.severity,
    human_title: '',
    human_description: '',
    evidence: [],
    suggested_action: '',
    confidence_label: `${Math.round(confidence * 100)}% confidence`,
    timestamp: flag.created_at,
  };

  // Map flag types to human-readable explanations
  switch (flag.flag_type) {
    case 'face_missing':
      return {
        ...baseExplanation,
        human_title: 'Face Not Detected',
        human_description: `The student's face was not detected in the camera frame for ${duration_seconds} seconds. This may indicate the student looked away from the screen, covered their camera, or left their desk.`,
        evidence: [
          `Duration: ${duration_seconds} seconds`,
          `Confidence: ${Math.round(confidence * 100)}%`,
          `Timestamp: ${new Date(flag.created_at).toLocaleTimeString()}`,
        ],
        suggested_action: 'Review the session timeline around the flagged timestamp. Check if the student had legitimate reasons to step away.',
      };

    case 'multiple_faces':
      return {
        ...baseExplanation,
        human_title: 'Multiple People Detected',
        human_description: `Multiple faces were detected in the camera frame during the exam. This suggests ${duration_seconds > 10 ? 'another person was present for an extended period' : 'another person may have briefly passed through the camera view'}.`,
        evidence: [
          `Number of faces detected: ${metadata.face_count || '2+'} faces`,
          `Duration visible: ${duration_seconds} seconds`,
          `Confidence: ${Math.round(confidence * 100)}%`,
          `Timestamp: ${new Date(flag.created_at).toLocaleTimeString()}`,
        ],
        suggested_action: 'Strongly recommend manual review of the session recording to verify intent. Consider warning or retest if suspicious.',
      };

    case 'gaze_away':
      return {
        ...baseExplanation,
        human_title: 'Student Looking Away from Screen',
        human_description: `The student's gaze was directed away from the exam screen for ${duration_seconds} seconds. This may indicate they were looking at external materials or distracted, or the detector may have been overly sensitive.`,
        evidence: [
          `Gaze away duration: ${duration_seconds} seconds`,
          `Frequency: ${metadata.event_count || 'once'} occurrence(s)`,
          `Confidence: ${Math.round(confidence * 100)}%`,
          `Timestamp: ${new Date(flag.created_at).toLocaleTimeString()}`,
        ],
        suggested_action: 'Low-severity by itself. Review video to confirm. Consider whether student may have been reading the question or thinking.',
      };

    case 'phone_detected':
      return {
        ...baseExplanation,
        human_title: 'Mobile Device Detected',
        human_description: `A mobile device or phone was detected in the student's environment during the exam. This suggests potential unauthorized access to external resources or communication.`,
        evidence: [
          `Device type: ${metadata.device_type || 'Mobile phone/tablet'}`,
          `Visible duration: ${duration_seconds} seconds`,
          `Confidence: ${Math.round(confidence * 100)}%`,
          `Timestamp: ${new Date(flag.created_at).toLocaleTimeString()}`,
        ],
        suggested_action: 'Recommend immediate manual review. High-risk indicator. Consider disqualification depending on institutional policy.',
      };

    case 'copy_paste':
      return {
        ...baseExplanation,
        human_title: 'Copy-Paste Attempt Detected',
        human_description: `The student attempted a copy or paste operation during the exam. This is ${flag.severity === 'critical' ? 'a strong' : 'a potential'} indicator of unauthorized resource use or answer copying.`,
        evidence: [
          `Number of copy/paste attempts: ${metadata.event_count || 1}`,
          `Action type: ${metadata.action_type || 'Copy or Paste'}`,
          `Confidence: ${Math.round(confidence * 100)}%`,
          `Timestamp: ${new Date(flag.created_at).toLocaleTimeString()}`,
        ],
        suggested_action: 'Review video of the flagged time. If content was pasted into answers, compare with known sources for plagiarism.',
      };

    case 'tab_switch':
      return {
        ...baseExplanation,
        human_title: 'Browser Tab Switch Detected',
        human_description: `The student switched away from the exam browser tab ${metadata.switch_count || 1} time(s). This suggests they may have accessed external resources or were distracted.`,
        evidence: [
          `Number of tab switches: ${metadata.switch_count || 1}`,
          `Time away: ${duration_seconds} seconds (longest)`,
          `Confidence: ${Math.round(confidence * 100)}%`,
          `Timestamp: ${new Date(flag.created_at).toLocaleTimeString()}`,
        ],
        suggested_action: 'Moderate concern. Review the answers during the gap period. Some tab-switches may be unavoidable (system notifications, browser issues).',
      };

    case 'unnatural_typing':
      return {
        ...baseExplanation,
        human_title: 'Unusual Typing Pattern Detected',
        human_description: `The student's typing pattern appeared unnatural, suggesting they may have pasted text or had assistance writing answers. This could also be a false positive if the student was copying between exam questions.`,
        evidence: [
          `Pattern anomaly type: ${metadata.pattern_type || 'Rapid text insertion'}`,
          `Text length: ${metadata.text_length || 'N/A'} characters`,
          `Confidence: ${Math.round(confidence * 100)}%`,
          `Timestamp: ${new Date(flag.created_at).toLocaleTimeString()}`,
        ],
        suggested_action: 'Review the student\'s actual answer text. Compare writing style across answers for consistency.',
      };

    case 'collusion_detected':
      return {
        ...baseExplanation,
        human_title: 'Potential Answer Collusion',
        human_description: `This student's answer was ${similarity_percent_label} semantically similar to ${student_b_name}'s answer. The phrasing, structure, and content suggest possible answer sharing or copying.`,
        evidence: [
          `Similarity Score: ${similarity_percent_label}`,
          `Compared with: ${student_b_name}`,
          `Verdict: ${metadata.verdict || 'Highly Similar'}`,
          `Question: ${metadata.question_text || 'N/A'}`,
        ],
        suggested_action: 'Strongly recommend manual comparison of both student responses. Consider conducting separate interviews to verify understanding.',
      };

    default:
      return {
        ...baseExplanation,
        human_title: flag.flag_type,
        human_description: `Flag detected: ${flag.flag_type}. Please review the raw metadata below.`,
        evidence: Object.entries(metadata)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .slice(0, 5),
        suggested_action: 'Review the raw flag data in the database for detailed information.',
      };
  }
}

/**
 * Group flags by severity level (high-to-low)
 */
export function groupFlagsBySeverity(
  explanations: FlagExplanation[]
): Record<string, FlagExplanation[]> {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  const grouped: Record<string, FlagExplanation[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  explanations.forEach((exp) => {
    grouped[exp.severity].push(exp);
  });

  // Sort within each group by timestamp (most recent first)
  Object.keys(grouped).forEach((severity) => {
    grouped[severity].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  return grouped;
}

/**
 * Generate a summary string for all flags
 */
export function generateFlagSummary(explanations: FlagExplanation[]): string {
  const counts = {
    critical: explanations.filter((e) => e.severity === 'critical').length,
    high: explanations.filter((e) => e.severity === 'high').length,
    medium: explanations.filter((e) => e.severity === 'medium').length,
    low: explanations.filter((e) => e.severity === 'low').length,
  };

  const total = explanations.length;

  if (total === 0) {
    return 'No flags detected. Student behavior appears normal.';
  }

  const parts = [];
  if (counts.critical > 0)
    parts.push(`${counts.critical} critical flag${counts.critical > 1 ? 's' : ''}`);
  if (counts.high > 0)
    parts.push(`${counts.high} high-severity flag${counts.high > 1 ? 's' : ''}`);
  if (counts.medium > 0)
    parts.push(`${counts.medium} medium-severity flag${counts.medium > 1 ? 's' : ''}`);
  if (counts.low > 0)
    parts.push(`${counts.low} low-severity flag${counts.low > 1 ? 's' : ''}`);

  return `${total} total flag${total > 1 ? 's' : ''} detected: ${parts.join(', ')}.`;
}
