/**
 * ScreenLockEnforcer - Enforces fullscreen mode and detects exit attempts
 * Counts fullscreen exits and locks exam after max attempts
 */

export interface ScreenLockStats {
  exitCount: number;
  isFullscreenActive: boolean;
  lastExitTime: number | null;
  exitAttempts: {
    timestamp: number;
    attemptNumber: number;
  }[];
}

type ScreenLockCallback = (exitCount: number) => void;

class ScreenLockEnforcer {
  private isActive: boolean = false;
  private exitCount: number = 0;
  private isFullscreenActive: boolean = false;
  private lastExitTime: number | null = null;
  private sessionId: string;
  private examId: string;
  private studentId: string;
  private maxExits: number = 3;
  private warningCallback: ScreenLockCallback | null = null;
  private lockCallback: (() => void) | null = null;
  private exitAttempts: { timestamp: number; attemptNumber: number }[] = [];

  /**
   * Initialize ScreenLockEnforcer
   * @param sessionId - Current exam session ID
   * @param examId - Current exam ID
   * @param studentId - Current student ID
   * @param warningCallback - Called with exit count when a violation occurs
   * @param lockCallback - Called when max exits reached
   * @param maxExits - Maximum allowed fullscreen exits (default: 3)
   */
  constructor(
    sessionId: string,
    examId: string,
    studentId: string,
    warningCallback?: ScreenLockCallback,
    lockCallback?: () => void,
    maxExits: number = 3
  ) {
    this.sessionId = sessionId;
    this.examId = examId;
    this.studentId = studentId;
    this.warningCallback = warningCallback || null;
    this.lockCallback = lockCallback || null;
    this.maxExits = maxExits;
  }

  /**
   * Enforce fullscreen mode
   */
  public async enforce(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    this.exitCount = 0;
    this.exitAttempts = [];
    this.isFullscreenActive = false;

    // Request fullscreen
    await this.requestFullscreen();

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange);
  }

  /**
   * Release fullscreen mode
   */
  public async release(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;

    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', this.handleFullscreenChange);

    // Exit fullscreen
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch (error) {
      console.error('[ScreenLockEnforcer] Error exiting fullscreen:', error);
    }
  }

  /**
   * Get exit count
   */
  public getExitCount(): number {
    return this.exitCount;
  }

  /**
   * Get fullscreen stats
   */
  public getStats(): ScreenLockStats {
    return {
      exitCount: this.exitCount,
      isFullscreenActive: this.isFullscreenActive,
      lastExitTime: this.lastExitTime,
      exitAttempts: [...this.exitAttempts],
    };
  }

  /**
   * Set new warning callback
   */
  public setWarningCallback(callback: ScreenLockCallback): void {
    this.warningCallback = callback;
  }

  /**
   * Set new lock callback
   */
  public setLockCallback(callback: () => void): void {
    this.lockCallback = callback;
  }

  /**
   * Request fullscreen
   */
  private async requestFullscreen(): Promise<void> {
    try {
      const element = document.documentElement;

      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      } else {
        console.warn('[ScreenLockEnforcer] Fullscreen API not supported');
      }
    } catch (error) {
      console.error('[ScreenLockEnforcer] Error requesting fullscreen:', error);
    }
  }

  /**
   * Check if in fullscreen mode
   */
  private isInFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  }

  /**
   * Handle fullscreen change event
   */
  private handleFullscreenChange = () => {
    const isNowFullscreen = this.isInFullscreen();

    if (!isNowFullscreen && this.isActive) {
      // Fullscreen was exited
      this.exitCount++;
      this.lastExitTime = Date.now();

      const attemptRecord = {
        timestamp: Date.now(),
        attemptNumber: this.exitCount,
      };
      this.exitAttempts.push(attemptRecord);

      console.warn(
        `[ScreenLockEnforcer] Fullscreen exit detected. Exit count: ${this.exitCount}/${this.maxExits}`
      );

      // Call warning callback
      if (this.warningCallback) {
        this.warningCallback(this.exitCount);
      }

      // Report to backend
      this.reportExitViolation(this.exitCount);

      // Check if max exits reached
      if (this.exitCount >= this.maxExits) {
        console.error(
          `[ScreenLockEnforcer] Maximum fullscreen exits (${this.maxExits}) reached. Locking exam.`
        );

        // Call lock callback
        if (this.lockCallback) {
          this.lockCallback();
        }

        // Report lock to backend
        this.reportExamLocked();
      } else {
        // Re-request fullscreen after a brief delay
        setTimeout(() => {
          if (this.isActive) {
            this.requestFullscreen();
          }
        }, 500);
      }
    } else if (isNowFullscreen && !this.isFullscreenActive) {
      // Entered fullscreen
      this.isFullscreenActive = true;
    }
  };

  /**
   * Report fullscreen exit violation to backend
   */
  private async reportExitViolation(exitCount: number): Promise<void> {
    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          exam_id: this.examId,
          student_id: this.studentId,
          event_type: 'fullscreen_exit',
          flag_type: 'fullscreen_exit',
          severity: 'high',
          confidence: 1.0,
          metadata: {
            exit_count: exitCount,
            max_exits: this.maxExits,
            timestamp: Date.now(),
          },
        }),
      });
    } catch (error) {
      console.error('[ScreenLockEnforcer] Failed to report exit violation:', error);
    }
  }

  /**
   * Report exam locked to backend
   */
  private async reportExamLocked(): Promise<void> {
    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          exam_id: this.examId,
          student_id: this.studentId,
          event_type: 'exam_locked_fullscreen',
          flag_type: 'exam_locked',
          severity: 'critical',
          confidence: 1.0,
          metadata: {
            reason: 'Maximum fullscreen exits exceeded',
            exit_count: this.exitCount,
            timestamp: Date.now(),
          },
        }),
      });
    } catch (error) {
      console.error('[ScreenLockEnforcer] Failed to report exam locked:', error);
    }
  }

  /**
   * Reset tracker state
   */
  public reset(): void {
    this.exitCount = 0;
    this.exitAttempts = [];
    this.lastExitTime = null;
  }
}

export default ScreenLockEnforcer;
