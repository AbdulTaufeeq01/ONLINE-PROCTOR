/**
 * Proctoring Frontend Modules - Main Export
 * 
 * This module provides complete frontend proctoring capabilities including:
 * - Keyboard tracking and anomaly detection
 * - Clipboard monitoring
 * - Window/tab focus tracking
 * - Fullscreen enforcement
 * - Webcam frame capture
 * - Voice activity detection
 * 
 * Usage:
 * ```typescript
 * import ProctoringSession from '@/proctoring/frontend'
 * 
 * const session = new ProctoringSession({
 *   sessionId: 'session-123',
 *   examId: 'exam-456',
 *   studentId: 'student-789',
 *   stream: mediaStream,
 * })
 * 
 * await session.start()
 * // Proctoring is now active...
 * const report = await session.stop()
 * ```
 */

// Export individual trackers
export { default as KeyboardTracker } from './KeyboardTracker';
export type { KeystrokeEvent, TypingBurst, KeyboardStats } from './KeyboardTracker';

export { default as ClipboardTracker } from './ClipboardTracker';
export type { ClipboardEventData, ClipboardStats } from './ClipboardTracker';

export { default as WindowFocusTracker } from './WindowFocusTracker';
export type { FocusEvent, WindowFocusStats } from './WindowFocusTracker';

export { default as ScreenLockEnforcer } from './ScreenLockEnforcer';
export type { ScreenLockStats } from './ScreenLockEnforcer';

export { default as WebcamCapture } from './WebcamCapture';
export type { FrameCaptureStats } from './WebcamCapture';

export { default as AudioVAD } from './AudioVAD';
export type { VoiceEvent, AudioVADStats } from './AudioVAD';

// Export orchestrator
export { default as ProctoringSession } from './ProctoringSession';
export type {
  ProctoringSessionConfig,
  ProctoringReport,
  FlagEvent,
} from './ProctoringSession';

// Export React component
export { default as ProctoringOverlay } from './ProctoringOverlay';
export type { ProctoringOverlayProps } from './ProctoringOverlay';
