/**
 * AudioVAD - Voice Activity Detection using Web Audio API
 * Detects sustained voice activity to catch unauthorized talking during exams
 */

export interface VoiceEvent {
  startTime: number;
  endTime: number;
  duration: number; // ms
  peakRMS: number;
}

export interface AudioVADStats {
  isListening: boolean;
  voiceDetectedCount: number;
  totalVoiceDuration: number; // ms
  voiceRatio: number; // 0-1, ratio of tracked time spent with voice
  currentlyDetected: boolean;
  events: VoiceEvent[];
}

class AudioVAD {
  private isActive: boolean = false;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animFrameId: number | null = null;
  private sessionId: string;
  private examId: string;
  private studentId: string;
  private voiceThreshold: number = 0.02; // RMS threshold for voice detection
  private sustainedDurationMs: number = 1500; // 1.5 seconds of continuous sound = voice
  private voiceStartTime: number | null = null;
  private voiceEvents: VoiceEvent[] = [];
  private currentPeakRMS: number = 0;
  private analysisInterval: number = 200; // ms between RMS checks
  private lastAnalysisTime: number = 0;
  private totalTrackedTime: number = 0;
  private trackingStartTime: number = 0;

  /**
   * Initialize AudioVAD
   * @param sessionId - Current exam session ID
   * @param examId - Current exam ID
   * @param studentId - Current student ID
   * @param voiceThreshold - RMS threshold for voice detection (default: 0.02)
   * @param sustainedDurationMs - Duration before flagging as voice (default: 1500ms)
   */
  constructor(
    sessionId: string,
    examId: string,
    studentId: string,
    voiceThreshold: number = 0.02,
    sustainedDurationMs: number = 1500
  ) {
    this.sessionId = sessionId;
    this.examId = examId;
    this.studentId = studentId;
    this.voiceThreshold = voiceThreshold;
    this.sustainedDurationMs = sustainedDurationMs;
  }

  /**
   * Start listening for voice activity
   * @param stream - MediaStream from getUserMedia
   */
  public async start(stream: MediaStream): Promise<void> {
    if (this.isActive) return;

    try {
      this.isActive = true;
      this.stream = stream;
      this.voiceEvents = [];
      this.voiceStartTime = null;
      this.currentPeakRMS = 0;
      this.trackingStartTime = Date.now();
      this.totalTrackedTime = 0;

      // Create audio context
      const audioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new audioContextClass();

      // Create analyser node
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      source.connect(this.analyser);

      // Create data array for frequency analysis
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      console.log('[AudioVAD] Started voice activity detection');

      // Start analysis loop
      this.analyzeAudio();
    } catch (error) {
      console.error('[AudioVAD] Failed to start voice detection:', error);
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop listening for voice activity
   */
  public async stop(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Close audio context if not already closed
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.error('[AudioVAD] Error closing audio context:', error);
      }
    }

    // If currently detecting voice, finalize the event
    if (this.voiceStartTime !== null) {
      const duration = Date.now() - this.voiceStartTime;
      const event: VoiceEvent = {
        startTime: this.voiceStartTime,
        endTime: Date.now(),
        duration,
        peakRMS: this.currentPeakRMS,
      };
      this.voiceEvents.push(event);
    }

    console.log('[AudioVAD] Stopped voice activity detection');
  }

  /**
   * Check if voice is currently detected
   */
  public isVoiceActive(): boolean {
    return this.voiceStartTime !== null;
  }

  /**
   * Get voice activity ratio (0-1)
   */
  public getVoiceRatio(): number {
    const now = Date.now();
    const totalTime = now - this.trackingStartTime;

    if (totalTime === 0) return 0;

    let totalVoiceTime = this.voiceEvents.reduce((sum, e) => sum + e.duration, 0);

    // Add current voice event if active
    if (this.voiceStartTime !== null) {
      totalVoiceTime += now - this.voiceStartTime;
    }

    return Math.min(totalVoiceTime / totalTime, 1);
  }

  /**
   * Get voice activity statistics
   */
  public getStats(): AudioVADStats {
    const now = Date.now();
    const totalTrackedTime = now - this.trackingStartTime;

    let totalVoiceDuration = this.voiceEvents.reduce((sum, e) => sum + e.duration, 0);

    // Add current voice event if active
    if (this.voiceStartTime !== null) {
      totalVoiceDuration += now - this.voiceStartTime;
    }

    return {
      isListening: this.isActive,
      voiceDetectedCount: this.voiceEvents.length,
      totalVoiceDuration,
      voiceRatio: totalTrackedTime > 0 ? Math.min(totalVoiceDuration / totalTrackedTime, 1) : 0,
      currentlyDetected: this.isVoiceActive(),
      events: [...this.voiceEvents],
    };
  }

  /**
   * Get all voice events
   */
  public getEvents(): VoiceEvent[] {
    return [...this.voiceEvents];
  }

  /**
   * Analyze audio using frequency analysis
   */
  private analyzeAudio = (): void => {
    if (!this.isActive || !this.analyser || !this.dataArray) {
      return;
    }

    const now = Date.now();

    // Analyze every 200ms
    if (now - this.lastAnalysisTime >= this.analysisInterval) {
      this.lastAnalysisTime = now;

      // Get frequency data
      this.analyser.getByteFrequencyData(this.dataArray as any);

      // Calculate RMS (Root Mean Square) of frequency data
      const rms = this.calculateRMS(this.dataArray);
      this.currentPeakRMS = Math.max(this.currentPeakRMS, rms);

      // Check if voice is detected
      const voiceDetected = rms > this.voiceThreshold;

      if (voiceDetected && this.voiceStartTime === null) {
        // Start of voice event
        this.voiceStartTime = now;
        this.currentPeakRMS = rms;
      } else if (!voiceDetected && this.voiceStartTime !== null) {
        // End of voice event
        const duration = now - this.voiceStartTime;

        // Only flag if sustained for required duration
        if (duration >= this.sustainedDurationMs) {
          const event: VoiceEvent = {
            startTime: this.voiceStartTime,
            endTime: now,
            duration,
            peakRMS: this.currentPeakRMS,
          };
          this.voiceEvents.push(event);

          console.log(
            `[AudioVAD] Voice event detected: ${duration}ms duration, ${this.voiceEvents.length} events so far`
          );

          // Report to backend
          this.reportVoiceEvent(duration);
        }

        this.voiceStartTime = null;
        this.currentPeakRMS = 0;
      }
    }

    this.animFrameId = requestAnimationFrame(this.analyzeAudio);
  };

  /**
   * Calculate RMS from frequency data
   * RMS = sqrt(sum(data^2) / length)
   */
  private calculateRMS(dataArray: Uint8Array): number {
    let sumSquares = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255; // Normalize to 0-1
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / dataArray.length);
    return rms;
  }

  /**
   * Report voice event to backend
   */
  private async reportVoiceEvent(duration: number): Promise<void> {
    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          exam_id: this.examId,
          student_id: this.studentId,
          event_type: 'voice_detected',
          flag_type: 'voice_detected',
          severity: 'medium',
          confidence: 0.7,
          metadata: {
            duration_ms: duration,
            threshold_ms: this.sustainedDurationMs,
            timestamp: Date.now(),
          },
        }),
      });
    } catch (error) {
      console.error('[AudioVAD] Failed to report voice event:', error);
    }
  }

  /**
   * Reset statistics
   */
  public reset(): void {
    this.voiceEvents = [];
    this.voiceStartTime = null;
    this.currentPeakRMS = 0;
    this.trackingStartTime = Date.now();
    this.totalTrackedTime = 0;
  }

  /**
   * Set voice detection threshold (0-1)
   */
  public setVoiceThreshold(threshold: number): void {
    this.voiceThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Set sustained duration before flagging
   */
  public setSustainedDuration(ms: number): void {
    this.sustainedDurationMs = Math.max(500, ms); // Minimum 500ms
  }
}

export default AudioVAD;
