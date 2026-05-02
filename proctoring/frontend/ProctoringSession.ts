/**
 * ProctoringSession - Master orchestrator for all proctoring trackers
 * Coordinates KeyboardTracker, ClipboardTracker, WindowFocusTracker, ScreenLockEnforcer,
 * WebcamCapture, and AudioVAD into a unified session
 */

import KeyboardTracker, { KeyboardStats } from './KeyboardTracker';
import ClipboardTracker, { ClipboardStats } from './ClipboardTracker';
import WindowFocusTracker, { WindowFocusStats } from './WindowFocusTracker';
import ScreenLockEnforcer, { ScreenLockStats } from './ScreenLockEnforcer';
import WebcamCapture, { FrameCaptureStats } from './WebcamCapture';
import AudioVAD, { AudioVADStats } from './AudioVAD';

export interface ProctoringSessionConfig {
  sessionId: string;
  examId: string;
  studentId: string;
  stream: MediaStream;
  onWarning?: (count: number) => void;
  onLock?: () => void;
  enableKeyboardTracking?: boolean;
  enableClipboardTracking?: boolean;
  enableWindowFocusTracking?: boolean;
  enableScreenLock?: boolean;
  enableWebcamCapture?: boolean;
  enableAudioVAD?: boolean;
  webcamCaptureInterval?: number; // seconds, default 30
  heartbeatInterval?: number; // seconds, default 30
  maxScreenLockExits?: number; // default 3
}

export interface ProctoringReport {
  keyboard: KeyboardStats;
  clipboard: ClipboardStats;
  windowFocus: WindowFocusStats;
  screenLock: ScreenLockStats;
  webcam: FrameCaptureStats;
  audio: AudioVADStats;
  sessionDuration: number; // ms
  startTime: number;
  endTime?: number;
}

export interface FlagEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

type EventListener = (event: FlagEvent) => void;

class ProctoringSession {
  private config: ProctoringSessionConfig;
  private isActive: boolean = false;
  private startTime: number = 0;
  private endTime: number = 0;

  // Tracker instances
  private keyboardTracker: KeyboardTracker | null = null;
  private clipboardTracker: ClipboardTracker | null = null;
  private windowFocusTracker: WindowFocusTracker | null = null;
  private screenLockEnforcer: ScreenLockEnforcer | null = null;
  private webcamCapture: WebcamCapture | null = null;
  private audioVAD: AudioVAD | null = null;

  // Heartbeat management
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs: number;

  // Event listeners
  private flagListeners: EventListener[] = [];

  /**
   * Initialize ProctoringSession
   * @param config - Configuration object with session details and enabled features
   */
  constructor(config: ProctoringSessionConfig) {
    this.config = {
      enableKeyboardTracking: true,
      enableClipboardTracking: true,
      enableWindowFocusTracking: true,
      enableScreenLock: true,
      enableWebcamCapture: true,
      enableAudioVAD: true,
      webcamCaptureInterval: 30,
      heartbeatInterval: 30,
      maxScreenLockExits: 3,
      ...config,
    };

    this.heartbeatIntervalMs = (this.config.heartbeatInterval || 30) * 1000;
  }

  /**
   * Start proctoring session - initialize all enabled trackers
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      console.warn('[ProctoringSession] Session already active');
      return;
    }

    try {
      this.isActive = true;
      this.startTime = Date.now();

      console.log(
        `[ProctoringSession] Starting proctoring session: ${this.config.sessionId}`
      );

      // Initialize keyboard tracker
      if (this.config.enableKeyboardTracking) {
        this.keyboardTracker = new KeyboardTracker(
          this.config.sessionId,
          this.config.examId,
          this.config.studentId
        );
        this.keyboardTracker.start();
        console.log('[ProctoringSession] ✓ KeyboardTracker started');
      }

      // Initialize clipboard tracker
      if (this.config.enableClipboardTracking) {
        this.clipboardTracker = new ClipboardTracker(
          this.config.sessionId,
          this.config.examId,
          this.config.studentId
        );
        this.clipboardTracker.start();
        console.log('[ProctoringSession] ✓ ClipboardTracker started');
      }

      // Initialize window focus tracker
      if (this.config.enableWindowFocusTracking) {
        this.windowFocusTracker = new WindowFocusTracker(
          this.config.sessionId,
          this.config.examId,
          this.config.studentId
        );
        this.windowFocusTracker.start();
        console.log('[ProctoringSession] ✓ WindowFocusTracker started');
      }

      // Initialize screen lock enforcer
      if (this.config.enableScreenLock) {
        this.screenLockEnforcer = new ScreenLockEnforcer(
          this.config.sessionId,
          this.config.examId,
          this.config.studentId,
          this.config.onWarning,
          this.config.onLock,
          this.config.maxScreenLockExits
        );
        await this.screenLockEnforcer.enforce();
        console.log('[ProctoringSession] ✓ ScreenLockEnforcer started');
      }

      // Initialize webcam capture
      if (this.config.enableWebcamCapture) {
        this.webcamCapture = new WebcamCapture(
          this.config.sessionId,
          this.config.examId,
          this.config.studentId,
          this.config.webcamCaptureInterval
        );
        await this.webcamCapture.start(this.config.stream);
        console.log('[ProctoringSession] ✓ WebcamCapture started');
      }

      // Initialize audio VAD
      if (this.config.enableAudioVAD) {
        this.audioVAD = new AudioVAD(
          this.config.sessionId,
          this.config.examId,
          this.config.studentId
        );
        await this.audioVAD.start(this.config.stream);
        console.log('[ProctoringSession] ✓ AudioVAD started');
      }

      // Start heartbeat
      this.startHeartbeat();
      console.log('[ProctoringSession] ✓ Heartbeat started');

      console.log('[ProctoringSession] All trackers initialized successfully');
    } catch (error) {
      console.error('[ProctoringSession] Failed to start session:', error);
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop proctoring session - cleanup all trackers
   */
  public async stop(): Promise<ProctoringReport> {
    if (!this.isActive) {
      console.warn('[ProctoringSession] Session not active');
      return this.getFullReport();
    }

    try {
      this.isActive = false;
      this.endTime = Date.now();

      console.log('[ProctoringSession] Stopping proctoring session');

      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Stop all trackers
      if (this.keyboardTracker) {
        this.keyboardTracker.stop();
      }

      if (this.clipboardTracker) {
        this.clipboardTracker.stop();
      }

      if (this.windowFocusTracker) {
        this.windowFocusTracker.stop();
      }

      if (this.screenLockEnforcer) {
        await this.screenLockEnforcer.release();
      }

      if (this.webcamCapture) {
        await this.webcamCapture.stop();
      }

      if (this.audioVAD) {
        await this.audioVAD.stop();
      }

      // Send final report to backend
      const report = this.getFullReport();
      await this.sendSessionEnd(report);

      console.log('[ProctoringSession] Session stopped and report sent');

      return report;
    } catch (error) {
      console.error('[ProctoringSession] Error stopping session:', error);
      throw error;
    }
  }

  /**
   * Get full report combining all trackers
   */
  public getFullReport(): ProctoringReport {
    const now = Date.now();
    const sessionDuration = (this.endTime || now) - this.startTime;

    return {
      keyboard: this.keyboardTracker?.getStats() || ({} as KeyboardStats),
      clipboard: this.clipboardTracker?.getStats() || ({} as ClipboardStats),
      windowFocus: this.windowFocusTracker?.getStats() || ({} as WindowFocusStats),
      screenLock: this.screenLockEnforcer?.getStats() || ({} as ScreenLockStats),
      webcam: this.webcamCapture?.getStats() || ({} as FrameCaptureStats),
      audio: this.audioVAD?.getStats() || ({} as AudioVADStats),
      sessionDuration,
      startTime: this.startTime,
      endTime: this.endTime,
    };
  }

  /**
   * Get current session summary (live)
   */
  public getSessionSummary(): ProctoringReport {
    return this.getFullReport();
  }

  /**
   * Register listener for flag events
   * @param listener - Function called when a flag event occurs
   */
  public on(listener: EventListener): void {
    this.flagListeners.push(listener);
  }

  /**
   * Unregister listener for flag events
   */
  public off(listener: EventListener): void {
    this.flagListeners = this.flagListeners.filter((l) => l !== listener);
  }

  /**
   * Emit flag event to all listeners
   */
  private emitFlag(event: FlagEvent): void {
    this.flagListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ProctoringSession] Error in flag listener:', error);
      }
    });
  }

  /**
   * Start periodic heartbeat to send stats to backend
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  /**
   * Send heartbeat with current stats
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.isActive) return;

    try {
      const report = this.getSessionSummary();

      const response = await fetch('/api/proctor/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.config.sessionId,
          exam_id: this.config.examId,
          student_id: this.config.studentId,
          timestamp: Date.now(),
          stats: {
            keyboard: report.keyboard,
            clipboard: report.clipboard,
            window_focus: report.windowFocus,
            screen_lock: report.screenLock,
            webcam: report.webcam,
            audio: report.audio,
            session_duration_ms: Date.now() - this.startTime,
          },
        }),
      });

      if (!response.ok) {
        console.error('[ProctoringSession] Heartbeat failed:', response.statusText);
        return;
      }

      const data = await response.json();

      // Handle any actions from backend (e.g., warnings, locks)
      if (data.actions && Array.isArray(data.actions)) {
        data.actions.forEach((action: string) => {
          if (action === 'warn_student' && data.warning_message) {
            const flag: FlagEvent = {
              type: 'warning',
              severity: 'high',
              timestamp: Date.now(),
              metadata: { message: data.warning_message },
            };
            this.emitFlag(flag);
          } else if (action === 'lock_exam') {
            const flag: FlagEvent = {
              type: 'exam_locked',
              severity: 'critical',
              timestamp: Date.now(),
            };
            this.emitFlag(flag);
          }
        });
      }
    } catch (error) {
      console.error('[ProctoringSession] Heartbeat error:', error);
    }
  }

  /**
   * Send final session report to backend
   */
  private async sendSessionEnd(report: ProctoringReport): Promise<void> {
    try {
      await fetch('/api/proctor/session-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.config.sessionId,
          exam_id: this.config.examId,
          student_id: this.config.studentId,
          timestamp: Date.now(),
          session_log: report,
        }),
      });
    } catch (error) {
      console.error('[ProctoringSession] Failed to send session end:', error);
    }
  }

  /**
   * Check if session is active
   */
  public isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get session details
   */
  public getSessionDetails() {
    return {
      sessionId: this.config.sessionId,
      examId: this.config.examId,
      studentId: this.config.studentId,
      isActive: this.isActive,
      startTime: this.startTime,
      duration: (this.endTime || Date.now()) - this.startTime,
    };
  }
}

export default ProctoringSession;
