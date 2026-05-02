/**
 * KeyboardTracker - Detects keystroke anomalies and typing patterns
 * Tracks keystroke timing to detect paste-as-typing and unnatural typing speed
 */

export interface KeystrokeEvent {
  timestamp: number;
  keyType: 'letter' | 'number' | 'special' | 'control';
}

export interface TypingBurst {
  timestamp: number;
  charCount: number;
  duration: number; // ms
  charsPerSecond: number;
}

export interface SuspiciousPattern {
  type: 'rapid_burst' | 'slow_typing' | 'unnatural_pattern';
  timestamp: number;
  details: string;
  severity: 'medium' | 'high';
}

export interface KeyboardStats {
  totalKeystrokes: number;
  avgTimeBetweenKeys: number; // ms
  burstCount: number;
  suspiciousPatterns: SuspiciousPattern[];
  maxCharsPerSecond: number;
  minCharsPerSecond: number;
}

class KeyboardTracker {
  private isActive: boolean = false;
  private keystrokes: KeystrokeEvent[] = [];
  private typingWindow: KeystrokeEvent[] = [];
  private bursts: TypingBurst[] = [];
  private suspiciousPatterns: SuspiciousPattern[] = [];
  private windowInterval: NodeJS.Timeout | null = null;
  private sessionId: string;
  private examId: string;
  private studentId: string;
  private windowDurationMs: number = 2000; // 2 second window for typing analysis
  private burstThreshold: number = 40; // chars in 2 seconds = suspicious

  /**
   * Initialize KeyboardTracker
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
   * Start tracking keyboard events
   */
  public start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.keystrokes = [];
    this.bursts = [];
    this.suspiciousPatterns = [];
    this.typingWindow = [];

    document.addEventListener('keydown', this.handleKeyDown);

    // Every 2 seconds, analyze the typing window
    this.windowInterval = setInterval(() => {
      this.analyzeTypingWindow();
    }, this.windowDurationMs);
  }

  /**
   * Stop tracking keyboard events
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    document.removeEventListener('keydown', this.handleKeyDown);

    if (this.windowInterval) {
      clearInterval(this.windowInterval);
      this.windowInterval = null;
    }

    // Final analysis
    this.analyzeTypingWindow();
  }

  /**
   * Get current keyboard statistics
   */
  public getStats(): KeyboardStats {
    const avgTime =
      this.keystrokes.length > 1
        ? this.keystrokes.reduce((sum, k, i, arr) => {
            if (i === 0) return 0;
            return sum + (k.timestamp - arr[i - 1].timestamp);
          }, 0) / (this.keystrokes.length - 1)
        : 0;

    const charsPerSecondValues = this.bursts.map((b) => b.charsPerSecond);
    const maxCharsPerSecond = Math.max(...charsPerSecondValues, 0);
    const minCharsPerSecond = Math.min(...charsPerSecondValues.filter((v) => v > 0), 0);

    return {
      totalKeystrokes: this.keystrokes.length,
      avgTimeBetweenKeys: avgTime,
      burstCount: this.bursts.length,
      suspiciousPatterns: this.suspiciousPatterns,
      maxCharsPerSecond,
      minCharsPerSecond: minCharsPerSecond === 0 ? 0 : minCharsPerSecond,
    };
  }

  /**
   * Get all recorded keystrokes
   */
  public getKeystrokes(): KeystrokeEvent[] {
    return [...this.keystrokes];
  }

  /**
   * Get all detected bursts
   */
  public getBursts(): TypingBurst[] {
    return [...this.bursts];
  }

  /**
   * Reset tracker state
   */
  public reset(): void {
    this.keystrokes = [];
    this.bursts = [];
    this.suspiciousPatterns = [];
    this.typingWindow = [];
  }

  /**
   * Handle keydown event - categorize keystroke
   */
  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key;
    let keyType: KeystrokeEvent['keyType'] = 'special';

    if (/^[a-zA-Z]$/.test(key)) keyType = 'letter';
    else if (/^[0-9]$/.test(key)) keyType = 'number';
    else if (['Backspace', 'Delete', 'Enter', 'Tab', 'Shift', 'Control', 'Alt'].includes(key))
      keyType = 'control';

    const keystroke: KeystrokeEvent = {
      timestamp: Date.now(),
      keyType,
    };

    this.keystrokes.push(keystroke);
    this.typingWindow.push(keystroke);

    // Only count printable characters for burst detection
    if (keyType === 'letter' || keyType === 'number') {
      // Window is updated for analysis
    }
  };

  /**
   * Analyze typing window every 2 seconds
   */
  private analyzeTypingWindow(): void {
    if (this.typingWindow.length === 0) {
      return;
    }

    const printableChars = this.typingWindow.filter((k) => k.keyType !== 'control');
    const charCount = printableChars.length;

    if (charCount === 0) {
      this.typingWindow = [];
      return;
    }

    const duration = this.windowDurationMs;
    const charsPerSecond = (charCount / duration) * 1000;

    const burst: TypingBurst = {
      timestamp: Date.now(),
      charCount,
      duration,
      charsPerSecond,
    };

    this.bursts.push(burst);

    // Detect suspicious patterns
    // Pattern 1: Rapid burst (> 40 chars in 2 seconds = paste-like)
    if (charCount > this.burstThreshold) {
      const pattern: SuspiciousPattern = {
        type: 'rapid_burst',
        timestamp: Date.now(),
        details: `${charCount} characters typed in ${duration}ms (${charsPerSecond.toFixed(1)} chars/sec)`,
        severity: 'high',
      };
      this.suspiciousPatterns.push(pattern);

      // POST to backend
      this.reportSuspiciousPattern(pattern);
    }

    // Pattern 2: Very slow typing (< 1 char per second for extended period)
    // Could indicate copy-pasting character by character
    if (charCount > 5 && charsPerSecond < 1) {
      const pattern: SuspiciousPattern = {
        type: 'slow_typing',
        timestamp: Date.now(),
        details: `Unusually slow typing: ${charsPerSecond.toFixed(2)} chars/sec over ${charCount} chars`,
        severity: 'medium',
      };
      this.suspiciousPatterns.push(pattern);
    }

    // Reset window
    this.typingWindow = [];
  }

  /**
   * Report suspicious pattern to backend
   */
  private async reportSuspiciousPattern(pattern: SuspiciousPattern): Promise<void> {
    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          exam_id: this.examId,
          student_id: this.studentId,
          event_type: 'keyboard_anomaly',
          flag_type: 'keyboard_anomaly',
          severity: pattern.severity,
          confidence: 0.75,
          metadata: {
            pattern_type: pattern.type,
            details: pattern.details,
          },
        }),
      });
    } catch (error) {
      console.error('[KeyboardTracker] Failed to report suspicious pattern:', error);
    }
  }
}

export default KeyboardTracker;
