/**
 * WindowFocusTracker - Detects tab switches and window focus loss
 * Tracks when student leaves the exam tab or browser window
 */

export type FocusEventType = 'tab_hidden' | 'tab_visible' | 'blur' | 'focus';

export interface FocusEvent {
  type: FocusEventType;
  timestamp: number;
  duration?: number; // for focus loss events
}

export interface WindowFocusStats {
  focusLossCount: number;
  totalTimeOutOfFocus: number; // ms
  focusRegainCount: number;
  totalFocusTime: number; // ms
  longestFocusLoss: number; // ms
  events: FocusEvent[];
}

class WindowFocusTracker {
  private isActive: boolean = false;
  private events: FocusEvent[] = [];
  private sessionId: string;
  private examId: string;
  private studentId: string;
  private focusLossStartTime: number | null = null;
  private totalTimeOutOfFocus: number = 0;
  private focusLossCount: number = 0;
  private focusRegainCount: number = 0;
  private longestFocusLoss: number = 0;
  private trackingStartTime: number = 0;

  /**
   * Initialize WindowFocusTracker
   * @param sessionId - Current exam session ID
   * @param examId - Current exam ID
   * @param studentId - Current student ID
   */
  constructor(sessionId: string, examId: string, studentId: string) {
    this.sessionId = sessionId;
    this.examId = examId;
    this.studentId = studentId;
  }

  /**
   * Start tracking focus events
   */
  public start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.events = [];
    this.totalTimeOutOfFocus = 0;
    this.focusLossCount = 0;
    this.focusRegainCount = 0;
    this.longestFocusLoss = 0;
    this.trackingStartTime = Date.now();

    // Track tab visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Track window blur/focus
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('focus', this.handleFocus);
  }

  /**
   * Stop tracking focus events
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);

    // If currently out of focus, calculate final duration
    if (this.focusLossStartTime !== null) {
      const duration = Date.now() - this.focusLossStartTime;
      this.totalTimeOutOfFocus += duration;
      this.longestFocusLoss = Math.max(this.longestFocusLoss, duration);
    }
  }

  /**
   * Get focus statistics
   */
  public getStats(): WindowFocusStats {
    const now = Date.now();
    let currentOutOfFocusTime = 0;

    // If currently out of focus, include that time
    if (this.focusLossStartTime !== null) {
      currentOutOfFocusTime = now - this.focusLossStartTime;
    }

    return {
      focusLossCount: this.focusLossCount,
      totalTimeOutOfFocus: this.totalTimeOutOfFocus + currentOutOfFocusTime,
      focusRegainCount: this.focusRegainCount,
      totalFocusTime: now - this.trackingStartTime - (this.totalTimeOutOfFocus + currentOutOfFocusTime),
      longestFocusLoss: this.longestFocusLoss,
      events: [...this.events],
    };
  }

  /**
   * Get all focus events
   */
  public getEvents(): FocusEvent[] {
    return [...this.events];
  }

  /**
   * Check if currently focused
   */
  public isFocused(): boolean {
    return !document.hidden && document.visibilityState === 'visible';
  }

  /**
   * Handle tab visibility change (e.g., switching to another tab)
   */
  private handleVisibilityChange = () => {
    const now = Date.now();

    if (document.hidden) {
      // Tab is now hidden
      this.focusLossStartTime = now;
      this.focusLossCount++;

      const event: FocusEvent = {
        type: 'tab_hidden',
        timestamp: now,
      };
      this.events.push(event);

      // Report to backend immediately
      this.reportFocusLoss('tab_hidden');
    } else {
      // Tab is now visible
      if (this.focusLossStartTime !== null) {
        const duration = now - this.focusLossStartTime;
        this.totalTimeOutOfFocus += duration;
        this.longestFocusLoss = Math.max(this.longestFocusLoss, duration);
        this.focusLossStartTime = null;
      }

      this.focusRegainCount++;

      const event: FocusEvent = {
        type: 'tab_visible',
        timestamp: now,
      };
      this.events.push(event);
    }
  };

  /**
   * Handle window blur (e.g., clicking to another application)
   */
  private handleBlur = () => {
    const now = Date.now();

    this.focusLossStartTime = now;
    this.focusLossCount++;

    const event: FocusEvent = {
      type: 'blur',
      timestamp: now,
    };
    this.events.push(event);

    // Report to backend
    this.reportFocusLoss('blur');
  };

  /**
   * Handle window focus (e.g., clicking back to browser)
   */
  private handleFocus = () => {
    const now = Date.now();

    if (this.focusLossStartTime !== null) {
      const duration = now - this.focusLossStartTime;
      this.totalTimeOutOfFocus += duration;
      this.longestFocusLoss = Math.max(this.longestFocusLoss, duration);
      this.focusLossStartTime = null;
    }

    this.focusRegainCount++;

    const event: FocusEvent = {
      type: 'focus',
      timestamp: now,
    };
    this.events.push(event);
  };

  /**
   * Report focus loss to backend
   */
  private async reportFocusLoss(eventType: FocusEventType): Promise<void> {
    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          exam_id: this.examId,
          student_id: this.studentId,
          event_type: eventType,
          flag_type: 'tab_switch',
          severity: 'medium',
          confidence: 0.95,
          metadata: {
            event_type: eventType,
            timestamp: Date.now(),
          },
        }),
      });
    } catch (error) {
      console.error('[WindowFocusTracker] Failed to report focus loss:', error);
    }
  }

  /**
   * Reset tracker state
   */
  public reset(): void {
    this.events = [];
    this.totalTimeOutOfFocus = 0;
    this.focusLossCount = 0;
    this.focusRegainCount = 0;
    this.longestFocusLoss = 0;
    this.focusLossStartTime = null;
    this.trackingStartTime = Date.now();
  }
}

export default WindowFocusTracker;
