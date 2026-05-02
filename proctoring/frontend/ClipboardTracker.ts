/**
 * ClipboardTracker - Detects copy, cut, paste events and analyzes paste content size
 * Flags suspicious large pastes that could indicate answer copying
 */

export interface ClipboardEventData {
  type: 'copy' | 'cut' | 'paste';
  timestamp: number;
  charCount?: number; // for paste events
  sourceLength?: number; // total answer field length when paste occurred
  percentageOfTotal?: number; // paste size as % of source length
}

export interface ClipboardStats {
  totalEvents: number;
  copyCount: number;
  cutCount: number;
  pasteCount: number;
  largePasteCount: number; // pastes > 50 chars or > 30% of answer
  events: ClipboardEventData[];
  suspiciousPatterns: {
    timestamp: number;
    reason: string;
  }[];
}

class ClipboardTracker {
  private isActive: boolean = false;
  private events: ClipboardEventData[] = [];
  private sessionId: string;
  private examId: string;
  private studentId: string;
  private largePasteThreshold: number = 50; // characters
  private percentageThreshold: number = 0.3; // 30% of answer length
  private suspiciousPatterns: { timestamp: number; reason: string }[] = [];

  /**
   * Initialize ClipboardTracker
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
   * Start tracking clipboard events
   */
  public start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.events = [];
    this.suspiciousPatterns = [];

    document.addEventListener('copy', this.handleCopy as any);
    document.addEventListener('cut', this.handleCut as any);
    document.addEventListener('paste', this.handlePaste as any);
    document.addEventListener('contextmenu', this.handleContextMenu as any);

    // Also listen for keyboard shortcuts as backup
    document.addEventListener('keydown', this.handleKeyboardShortcuts as any);
  }

  /**
   * Stop tracking clipboard events
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    document.removeEventListener('copy', this.handleCopy as any);
    document.removeEventListener('cut', this.handleCut as any);
    document.removeEventListener('paste', this.handlePaste as any);
    document.removeEventListener('contextmenu', this.handleContextMenu as any);
    document.removeEventListener('keydown', this.handleKeyboardShortcuts as any);
  }

  /**
   * Get all clipboard events
   */
  public getEvents(): ClipboardEventData[] {
    return [...this.events];
  }

  /**
   * Get clipboard statistics
   */
  public getStats(): ClipboardStats {
    const copyCount = this.events.filter((e) => e.type === 'copy').length;
    const cutCount = this.events.filter((e) => e.type === 'cut').length;
    const pasteCount = this.events.filter((e) => e.type === 'paste').length;
    const largePasteCount = this.events.filter((e) => {
      if (e.type !== 'paste') return false;
      if (!e.charCount) return false;
      return (
        e.charCount > this.largePasteThreshold ||
        (e.percentageOfTotal && e.percentageOfTotal > this.percentageThreshold)
      );
    }).length;

    return {
      totalEvents: this.events.length,
      copyCount,
      cutCount,
      pasteCount,
      largePasteCount,
      events: [...this.events],
      suspiciousPatterns: [...this.suspiciousPatterns],
    };
  }

  /**
   * Check if there are suspicious large pastes in first 60 seconds of exam
   */
  public hasSuspiciousEarlyPaste(): boolean {
    const now = Date.now();
    const earlyPastes = this.events.filter((e) => {
      if (e.type !== 'paste' || !e.charCount) return false;
      const ageSeconds = (now - e.timestamp) / 1000;
      return ageSeconds < 60 && e.charCount > 100;
    });
    return earlyPastes.length > 0;
  }

  /**
   * Handle copy event
   */
  private handleCopy = () => {
    const event: ClipboardEventData = {
      type: 'copy',
      timestamp: Date.now(),
    };
    this.events.push(event);
  };

  /**
   * Handle cut event
   */
  private handleCut = () => {
    const event: ClipboardEventData = {
      type: 'cut',
      timestamp: Date.now(),
    };
    this.events.push(event);
  };

  /**
   * Handle paste event - read clipboard data size
   */
  private handlePaste = async (event: ClipboardEvent & { clipboardData?: DataTransfer }) => {
    if (!event.clipboardData) {
      return;
    }

    const pastedText = event.clipboardData.getData('text/plain');
    const charCount = pastedText.length;

    // Get current focused element to estimate answer length
    const focusedElement = document.activeElement as HTMLTextAreaElement | HTMLInputElement;
    const currentAnswerLength = focusedElement?.value?.length || 0;
    const percentageOfTotal =
      currentAnswerLength > 0 ? charCount / currentAnswerLength : 0;

    const clipboardEvent: ClipboardEventData = {
      type: 'paste',
      timestamp: Date.now(),
      charCount,
      sourceLength: currentAnswerLength,
      percentageOfTotal,
    };

    this.events.push(clipboardEvent);

    // Check if suspicious
    const isSuspicious =
      charCount > this.largePasteThreshold ||
      percentageOfTotal > this.percentageThreshold;

    if (isSuspicious) {
      const reason =
        charCount > this.largePasteThreshold
          ? `Large paste: ${charCount} characters (threshold: ${this.largePasteThreshold})`
          : `Paste is ${(percentageOfTotal * 100).toFixed(1)}% of answer length (threshold: ${this.percentageThreshold * 100}%)`;

      this.suspiciousPatterns.push({
        timestamp: Date.now(),
        reason,
      });

      // Report to backend
      await this.reportSuspiciousPaste(charCount, percentageOfTotal, reason);
    }
  };

  /**
   * Handle context menu prevention
   */
  private handleContextMenu = (event: MouseEvent) => {
    // Don't prevent - just log it
    const contextEvent: ClipboardEventData = {
      type: 'copy', // treated as clipboard access attempt
      timestamp: Date.now(),
    };
    this.events.push(contextEvent);
  };

  /**
   * Listen for keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X)
   */
  private handleKeyboardShortcuts = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      const clipEvent: ClipboardEventData = {
        type: 'copy',
        timestamp: Date.now(),
      };
      this.events.push(clipEvent);
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      // Paste via keyboard - will be caught by handlePaste
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
      const clipEvent: ClipboardEventData = {
        type: 'cut',
        timestamp: Date.now(),
      };
      this.events.push(clipEvent);
    }
  };

  /**
   * Report suspicious paste to backend
   */
  private async reportSuspiciousPaste(
    charCount: number,
    percentageOfTotal: number,
    reason: string
  ): Promise<void> {
    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          exam_id: this.examId,
          student_id: this.studentId,
          event_type: 'clipboard_paste',
          flag_type: 'clipboard_paste',
          severity: 'high',
          confidence: 0.85,
          metadata: {
            char_count: charCount,
            percentage_of_total: percentageOfTotal,
            reason,
          },
        }),
      });
    } catch (error) {
      console.error('[ClipboardTracker] Failed to report suspicious paste:', error);
    }
  }

  /**
   * Reset tracker state
   */
  public reset(): void {
    this.events = [];
    this.suspiciousPatterns = [];
  }
}

export default ClipboardTracker;
