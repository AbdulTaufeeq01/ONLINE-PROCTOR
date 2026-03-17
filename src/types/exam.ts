import type {
  ExamSession,
  ExamSessionStatus,
  FlagSeverity,
} from "@/types/database";

export interface QuestionGradingDetail {
  question_id: string;
  question_type: string;
  marks_awarded: number;
  max_marks: number;
  feedback?: string;
}

export interface GradingResult {
  session_id: ExamSession["id"];
  status: ExamSessionStatus;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  details: QuestionGradingDetail[];
}

export type AIDetectionVerdict =
  | "human"
  | "ai"
  | "mixed"
  | "uncertain";

export interface AIDetectionResult {
  session_id: ExamSession["id"];
  question_id?: string;
  score: number;
  verdict: AIDetectionVerdict;
  reasons: string[];
  raw?: unknown;
}

export interface AIReportFlagSummary {
  flag_type: string;
  severity: FlagSeverity;
  count: number;
}

export interface AIReport {
  session_id: ExamSession["id"];
  overall_cheating_score: number;
  flag_summaries: AIReportFlagSummary[];
  narrative_summary: string;
  recommendations: string[];
  raw?: unknown;
}
