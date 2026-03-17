import type { ExamSession, Flag, FlagSeverity } from "@/types/database";

export type FlagType =
  | "webcam_off"
  | "no_face_detected"
  | "multiple_faces"
  | "looking_away"
  | "tab_switch"
  | "window_blur"
  | "suspicious_audio"
  | "other";

export { FlagSeverity };

export interface ProctoringState {
  session: ExamSession | null;
  is_webcam_active: boolean;
  is_microphone_active: boolean;
  is_fullscreen: boolean;
  is_tab_focused: boolean;
  cheating_score: number;
  flags: Flag[];
}
