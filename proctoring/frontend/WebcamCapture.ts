/**
 * WebcamCapture - Captures video frames and sends them to backend for analysis
 * Periodically captures frames from MediaStream and uploads as base64 JPEG
 */

export interface FrameCaptureStats {
  framesCaptured: number;
  framesUploaded: number;
  failedUploads: number;
  lastCaptureTime: number | null;
  lastUploadTime: number | null;
}

class WebcamCapture {
  private isActive: boolean = false;
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private framesCaptured: number = 0;
  private framesUploaded: number = 0;
  private failedUploads: number = 0;
  private lastCaptureTime: number | null = null;
  private lastUploadTime: number | null = null;
  private captureInterval: NodeJS.Timeout | null = null;
  private sessionId: string;
  private examId: string;
  private studentId: string;
  private intervalSeconds: number;
  private jpegQuality: number = 0.7;
  private frameIndex: number = 0;

  /**
   * Initialize WebcamCapture
   * @param sessionId - Current exam session ID
   * @param examId - Current exam ID
   * @param studentId - Current student ID
   * @param intervalSeconds - Interval between frame captures (default: 30)
   */
  constructor(
    sessionId: string,
    examId: string,
    studentId: string,
    intervalSeconds: number = 30
  ) {
    this.sessionId = sessionId;
    this.examId = examId;
    this.studentId = studentId;
    this.intervalSeconds = intervalSeconds;
  }

  /**
   * Start capturing frames from MediaStream
   * @param stream - MediaStream from getUserMedia
   */
  public async start(stream: MediaStream): Promise<void> {
    if (this.isActive) return;

    try {
      this.isActive = true;
      this.stream = stream;
      this.framesCaptured = 0;
      this.framesUploaded = 0;
      this.failedUploads = 0;
      this.frameIndex = 0;

      // Create hidden video element to play stream
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = stream;
      this.videoElement.play();
      this.videoElement.style.display = 'none';

      // Create offscreen canvas for frame capture
      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;
      this.canvasContext = this.canvasElement.getContext('2d', { alpha: false });

      // Start capture loop
      this.captureInterval = setInterval(() => {
        this.captureAndUploadFrame();
      }, this.intervalSeconds * 1000);

      console.log(
        `[WebcamCapture] Started capturing frames every ${this.intervalSeconds} seconds`
      );
    } catch (error) {
      console.error('[WebcamCapture] Failed to start frame capture:', error);
      this.isActive = false;
      throw error;
    }
  }

  /**
   * Stop capturing frames
   */
  public async stop(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Clean up video element
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement.remove();
      this.videoElement = null;
    }

    // Clean up canvas
    if (this.canvasElement) {
      this.canvasElement = null;
      this.canvasContext = null;
    }

    console.log(`[WebcamCapture] Stopped frame capture`);
  }

  /**
   * Get frame capture statistics
   */
  public getStats(): FrameCaptureStats {
    return {
      framesCaptured: this.framesCaptured,
      framesUploaded: this.framesUploaded,
      failedUploads: this.failedUploads,
      lastCaptureTime: this.lastCaptureTime,
      lastUploadTime: this.lastUploadTime,
    };
  }

  /**
   * Get number of frames captured
   */
  public getFrameCount(): number {
    return this.framesCaptured;
  }

  /**
   * Get number of successful uploads
   */
  public getUploadCount(): number {
    return this.framesUploaded;
  }

  /**
   * Get upload failure count
   */
  public getFailureCount(): number {
    return this.failedUploads;
  }

  /**
   * Capture current frame from video stream
   */
  private captureFrame(): string {
    if (!this.videoElement || !this.canvasContext || !this.canvasElement) {
      throw new Error('Canvas or video element not initialized');
    }

    try {
      // Draw current video frame to canvas
      this.canvasContext.drawImage(
        this.videoElement,
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );

      // Convert canvas to base64 JPEG
      const imageData = this.canvasElement.toDataURL('image/jpeg', this.jpegQuality);

      return imageData;
    } catch (error) {
      console.error('[WebcamCapture] Failed to capture frame:', error);
      throw error;
    }
  }

  /**
   * Capture and upload frame to backend
   */
  private async captureAndUploadFrame(): Promise<void> {
    if (!this.isActive || !this.videoElement) return;

    try {
      // Capture frame
      const frameData = this.captureFrame();
      this.framesCaptured++;
      this.lastCaptureTime = Date.now();

      // Upload frame
      await this.uploadFrame(frameData);
      this.framesUploaded++;
      this.lastUploadTime = Date.now();
      this.frameIndex++;
    } catch (error) {
      this.failedUploads++;
      console.error('[WebcamCapture] Frame capture/upload failed:', error);
    }
  }

  /**
   * Upload frame to backend
   */
  private async uploadFrame(frameData: string): Promise<void> {
    const timestamp = Date.now();

    try {
      const response = await fetch('/api/proctor/face-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          exam_id: this.examId,
          student_id: this.studentId,
          timestamp,
          frame_b64: frameData,
          frame_index: this.frameIndex,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to upload frame: ${response.statusText}`);
      }

      console.log(`[WebcamCapture] Frame ${this.frameIndex} uploaded successfully`);
    } catch (error) {
      console.error('[WebcamCapture] Failed to upload frame:', error);
      throw error;
    }
  }

  /**
   * Reset statistics
   */
  public reset(): void {
    this.framesCaptured = 0;
    this.framesUploaded = 0;
    this.failedUploads = 0;
    this.lastCaptureTime = null;
    this.lastUploadTime = null;
    this.frameIndex = 0;
  }

  /**
   * Set custom JPEG quality (0-1)
   */
  public setJpegQuality(quality: number): void {
    this.jpegQuality = Math.max(0, Math.min(1, quality));
  }

  /**
   * Set capture interval
   */
  public setInterval(seconds: number): void {
    this.intervalSeconds = Math.max(5, seconds); // Minimum 5 seconds
  }
}

export default WebcamCapture;
