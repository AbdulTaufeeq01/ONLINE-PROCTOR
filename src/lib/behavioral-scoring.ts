/**
 * Behavioral Scoring Module
 * Calculates behavioral risk scores based on captured flags and behavior logs
 */

export interface BehavioralAnalysis {
  tab_switches: number;
  face_absences: number;
  multiple_faces: number;
  paste_events: number;
  copy_attempts: number;
  fullscreen_exits: number;
  window_blur_events: number;
  noise_locked: boolean;
  speed_anomalies: number;
}

export interface BehavioralScoreResult {
  behavioral_score: number; // 0-100
  risk_level: string; // 'critical' | 'high' | 'moderate' | 'low'
  breakdown: {
    tab_switch_score: number;
    face_detection_score: number;
    paste_score: number;
    fullscreen_score: number;
    noise_score: number;
  };
  flagged_events: string[];
  severity: string;
}

/**
 * Calculate behavioral risk score from analyzed flags
 * @param analysis - Behavioral analysis with flag counts
 * @returns Behavioral score result with breakdown
 */
export function calculateBehavioralScore(
  analysis: BehavioralAnalysis
): BehavioralScoreResult {
  // Initialize breakdown scores
  const breakdown = {
    tab_switch_score: 0,
    face_detection_score: 0,
    paste_score: 0,
    fullscreen_score: 0,
    noise_score: 0,
  };

  const flagged_events: string[] = [];

  // ── Tab Switch Scoring ────────────────────────────────────────────────────
  // Each tab switch = 2 points, max 20 points (cap at 10 switches)
  breakdown.tab_switch_score = Math.min(20, analysis.tab_switches * 2);
  if (analysis.tab_switches > 0) {
    flagged_events.push(`${analysis.tab_switches} tab switch${analysis.tab_switches > 1 ? 'es' : ''}`);
  }
  if (analysis.tab_switches > 5) {
    flagged_events.push('Excessive tab switching detected');
  }

  // ── Face Detection Scoring ────────────────────────────────────────────────
  // Face absence = 5 points each, max 25 points
  // Multiple faces = 15 points each, max 30 points
  const face_absence_score = Math.min(25, analysis.face_absences * 5);
  const multiple_faces_score = Math.min(30, analysis.multiple_faces * 15);
  breakdown.face_detection_score = face_absence_score + multiple_faces_score;

  if (analysis.face_absences > 0) {
    flagged_events.push(`Face absent ${analysis.face_absences} times`);
  }
  if (analysis.multiple_faces > 0) {
    flagged_events.push(`Multiple faces detected ${analysis.multiple_faces} times`);
  }

  // ── Paste Event Scoring ───────────────────────────────────────────────────
  // Each paste = 8 points, max 32 points
  breakdown.paste_score = Math.min(32, analysis.paste_events * 8);
  if (analysis.paste_events > 0) {
    flagged_events.push(`${analysis.paste_events} paste event${analysis.paste_events > 1 ? 's' : ''}`);
  }
  if (analysis.copy_attempts > 0) {
    flagged_events.push(`${analysis.copy_attempts} copy attempt${analysis.copy_attempts > 1 ? 's' : ''}`);
  }

  // ── Fullscreen Exit Scoring ───────────────────────────────────────────────
  // Each fullscreen exit = 5 points, max 15 points
  breakdown.fullscreen_score = Math.min(15, analysis.fullscreen_exits * 5);
  if (analysis.fullscreen_exits > 0) {
    flagged_events.push(`Fullscreen exited ${analysis.fullscreen_exits} times`);
  }

  // ── Noise Locked Scoring ─────────────────────────────────────────────────
  // Single boolean event = 20 points
  breakdown.noise_score = analysis.noise_locked ? 20 : 0;
  if (analysis.noise_locked) {
    flagged_events.push('Exam locked due to noise detection');
  }

  // ── Window Blur Scoring ──────────────────────────────────────────────────
  // (included in overall but not heavily weighted)
  if (analysis.window_blur_events > 5) {
    breakdown.tab_switch_score = Math.min(25, breakdown.tab_switch_score + 3);
    flagged_events.push(`Window blur detected ${analysis.window_blur_events} times`);
  }

  // ── Speed Anomaly Scoring ────────────────────────────────────────────────
  // Each anomaly = 5 points
  const speed_anomaly_score = Math.min(15, analysis.speed_anomalies * 5);
  if (analysis.speed_anomalies > 0) {
    flagged_events.push(`Answer speed anomal${analysis.speed_anomalies > 1 ? 'ies' : 'y'} detected`);
  }

  // Calculate total behavioral score (0-100)
  const raw_score =
    breakdown.tab_switch_score +
    breakdown.face_detection_score +
    breakdown.paste_score +
    breakdown.fullscreen_score +
    breakdown.noise_score +
    speed_anomaly_score;

  const behavioral_score = Math.min(100, raw_score);

  // Determine risk level based on score
  let risk_level: string;
  let severity: string;

  if (behavioral_score >= 75) {
    risk_level = 'critical';
    severity = 'high';
  } else if (behavioral_score >= 50) {
    risk_level = 'high';
    severity = 'high';
  } else if (behavioral_score >= 25) {
    risk_level = 'moderate';
    severity = 'medium';
  } else {
    risk_level = 'low';
    severity = 'low';
  }

  return {
    behavioral_score,
    risk_level,
    breakdown,
    flagged_events,
    severity,
  };
}

/**
 * Calculate combined cheating risk score
 * Combines behavioral + similarity + AI writing scores
 * @param flagScore - Score from flag events (0-100)
 * @param patternScore - Score from behavioral patterns (0-100)
 * @param aiWritingScore - Score from AI writing detection (0-100)
 * @returns Combined cheating score (0-100, NOT a percentage)
 */
export function calculateCombinedCheatingScore(
  flagScore: number,
  patternScore: number,
  aiWritingScore: number
): {
  score: number;
  riskLevel: string;
  breakdown: Record<string, number>;
} {
  // Weighted formula (must match backend calculation)
  const score = Math.min(
    100,
    Math.round(
      flagScore * 0.4 +      // 40% - direct flags
      patternScore * 0.35 +  // 35% - behavioral patterns
      aiWritingScore * 0.25  // 25% - AI writing detection
    )
  );

  const riskLevel =
    score >= 71
      ? 'critical'
      : score >= 46
        ? 'high'
        : score >= 21
          ? 'moderate'
          : 'low';

  return {
    score,
    riskLevel,
    breakdown: {
      flagScore,
      patternScore,
      aiWritingScore,
    },
  };
}
