export type ProfileRole = "teacher" | "student";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: ProfileRole;
  avatar_url: string | null;
  created_at: string;
}

export type ExamStatus = "draft" | "active" | "ended";

export interface Exam {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  pass_marks: number | null;
  shuffle_questions: boolean;
  webcam_required: boolean;
  fullscreen_required: boolean;
  allow_spelling_mistakes: boolean;
  status: ExamStatus;
  starts_at: string | null;
  created_at: string;
}

export type QuestionType = "mcq" | "short_answer" | "long_answer";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  exam_id: string;
  order_index: number;
  type: QuestionType;
  question_text: string;
  options: QuestionOption[] | null;
  correct_answer: string;
  marks: number;
  grading_hint: string | null;
}

export interface ExamInvite {
  id: string;
  exam_id: string;
  student_email: string;
  student_name: string | null;
  token: string;
  used: boolean;
  created_at: string;
}

export type ExamSessionStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "timed_out"
  | "terminated";

export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string | null;
  invite_id: string | null;
  daily_room_url: string | null;
  started_at: string | null;
  submitted_at: string | null;
  status: ExamSessionStatus;
  answers: Record<string, unknown>;
  score: number;
  max_score: number;
  cheating_score: number;
  ai_report: Record<string, unknown> | null;
  grading_details: Record<string, unknown> | null;
}

export type FlagSeverity = "low" | "medium" | "high" | "critical";

export interface Flag {
  id: string;
  session_id: string;
  student_id: string | null;
  exam_id: string;
  flag_type: string;
  severity: FlagSeverity;
  screenshot_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
      };
      exams: {
        Row: Exam;
      };
      questions: {
        Row: Question;
      };
      exam_invites: {
        Row: ExamInvite;
      };
      exam_sessions: {
        Row: ExamSession;
      };
      flags: {
        Row: Flag;
      };
    };
  };
}
