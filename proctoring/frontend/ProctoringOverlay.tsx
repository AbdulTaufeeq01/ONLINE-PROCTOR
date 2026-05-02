'use client';

/**
 * ProctoringOverlay - React component for displaying proctoring UI during exam
 * Shows status bar, webcam thumbnail, and warning modals
 */

import React, { useEffect, useState, useRef } from 'react';
import ProctoringSession, { FlagEvent, ProctoringReport } from './ProctoringSession';

export interface ProctoringOverlayProps {
  sessionId: string;
  examId: string;
  studentId: string;
  stream: MediaStream;
  onViolation?: (event: FlagEvent) => void;
  onSessionEnd?: (report: ProctoringReport) => void;
  enableAutoStart?: boolean;
  maxFullscreenExits?: number;
}

interface WarningState {
  visible: boolean;
  message: string;
  severity: 'warning' | 'critical';
  dismissTime?: number; // ms until auto-dismiss
}

interface StatusIndicators {
  proctoringActive: boolean;
  faceDetected: boolean;
  voiceActive: boolean;
  fullscreenActive: boolean;
}

const ProctoringOverlay: React.FC<ProctoringOverlayProps> = ({
  sessionId,
  examId,
  studentId,
  stream,
  onViolation,
  onSessionEnd,
  enableAutoStart = true,
  maxFullscreenExits = 3,
}) => {
  const [session, setSession] = useState<ProctoringSession | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [warning, setWarning] = useState<WarningState | null>(null);
  const [statusIndicators, setStatusIndicators] = useState<StatusIndicators>({
    proctoringActive: false,
    faceDetected: false,
    voiceActive: false,
    fullscreenActive: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const warningDismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize and start proctoring session
   */
  useEffect(() => {
    if (!enableAutoStart) return;

    const initSession = async () => {
      try {
        const proctoringSession = new ProctoringSession({
          sessionId,
          examId,
          studentId,
          stream,
          maxScreenLockExits: maxFullscreenExits,
          heartbeatInterval: 30,
          webcamCaptureInterval: 30,
        });

        // Listen for flag events
        proctoringSession.on((event: FlagEvent) => {
          handleFlagEvent(event);
          if (onViolation) {
            onViolation(event);
          }
        });

        await proctoringSession.start();
        setSession(proctoringSession);
        setIsSessionActive(true);

        console.log('[ProctoringOverlay] Session started');
      } catch (error) {
        console.error('[ProctoringOverlay] Failed to start session:', error);
      }
    };

    initSession();

    return () => {
      // Cleanup on unmount
      if (session && isSessionActive) {
        session.stop().catch((error) => {
          console.error('[ProctoringOverlay] Error during cleanup:', error);
        });
      }
    };
  }, [enableAutoStart, sessionId, examId, studentId, stream, maxFullscreenExits, onViolation]);

  /**
   * Update status indicators every second
   */
  useEffect(() => {
    if (!session || !isSessionActive) return;

    statusUpdateIntervalRef.current = setInterval(() => {
      const report = session.getSessionSummary();

      setStatusIndicators({
        proctoringActive: isSessionActive,
        faceDetected: (report.audio?.currentlyDetected || false) === false, // Inverted - no voice = face ok
        voiceActive: report.audio?.currentlyDetected || false,
        fullscreenActive: report.screenLock?.isFullscreenActive || false,
      });
    }, 1000);

    return () => {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
      }
    };
  }, [session, isSessionActive]);

  /**
   * Handle flag event from proctoring session
   */
  const handleFlagEvent = (event: FlagEvent) => {
    let message = 'Proctoring violation detected';
    let severity: 'warning' | 'critical' = 'warning';

    switch (event.type) {
      case 'warning':
        message = (event.metadata?.message as string) || 'Warning: Suspicious activity detected';
        severity = 'warning';
        break;
      case 'exam_locked':
        message = 'Your exam has been locked due to policy violations';
        severity = 'critical';
        break;
      case 'tab_switch':
        message = '⚠️ Warning: Do not leave the exam tab';
        severity = 'warning';
        break;
      case 'keyboard_anomaly':
        message = '⚠️ Warning: Unusual typing pattern detected';
        severity = 'warning';
        break;
      case 'clipboard_paste':
        message = '⚠️ Warning: Large paste detected';
        severity = 'warning';
        break;
      case 'voice_detected':
        message = '⚠️ Warning: Voice activity detected during exam';
        severity = 'warning';
        break;
      case 'fullscreen_exit':
        message = '⚠️ Warning: Fullscreen mode exited';
        severity = 'warning';
        break;
    }

    setWarning({
      visible: true,
      message,
      severity,
      dismissTime: 5000,
    });

    // Auto-dismiss warning after 5 seconds
    if (warningDismissTimeoutRef.current) {
      clearTimeout(warningDismissTimeoutRef.current);
    }

    if (severity === 'warning') {
      warningDismissTimeoutRef.current = setTimeout(() => {
        setWarning(null);
      }, 5000);
    }
  };

  /**
   * Dismiss warning modal
   */
  const dismissWarning = () => {
    setWarning(null);
    if (warningDismissTimeoutRef.current) {
      clearTimeout(warningDismissTimeoutRef.current);
    }
  };

  /**
   * Stop session and end proctoring
   */
  const handleEndSession = async () => {
    if (!session) return;

    try {
      const report = await session.stop();
      setIsSessionActive(false);

      if (onSessionEnd) {
        onSessionEnd(report);
      }

      console.log('[ProctoringOverlay] Session ended');
    } catch (error) {
      console.error('[ProctoringOverlay] Error ending session:', error);
    }
  };

  return (
    <>
      {/* Status Bar - Top of screen */}
      <div
        className="fixed top-0 left-0 right-0 z-[9998] bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 shadow-lg"
        style={{ pointerEvents: 'none' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
          {/* Left: Status indicators */}
          <div className="flex items-center gap-4">
            {/* Proctoring active */}
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  statusIndicators.proctoringActive
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-gray-500'
                }`}
              />
              <span>{statusIndicators.proctoringActive ? 'Proctoring Active' : 'Paused'}</span>
            </div>

            {/* Face detected */}
            <div className="flex items-center gap-2">
              <span>👁️</span>
              <span>{statusIndicators.faceDetected ? 'Face Visible' : 'No Face'}</span>
            </div>

            {/* Voice detection */}
            <div className="flex items-center gap-2">
              <span>{statusIndicators.voiceActive ? '🔊' : '🔇'}</span>
              <span>{statusIndicators.voiceActive ? 'Voice Detected' : 'Quiet'}</span>
            </div>

            {/* Fullscreen */}
            <div className="flex items-center gap-2">
              <span>⛶</span>
              <span>{statusIndicators.fullscreenActive ? 'Fullscreen' : 'Windowed'}</span>
            </div>
          </div>

          {/* Right: Webcam thumbnail */}
          <div
            className="w-24 h-20 bg-black rounded border border-slate-600 overflow-hidden"
            style={{ pointerEvents: 'auto' }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Warning Modal - Center of screen */}
      {warning && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ pointerEvents: warning ? 'auto' : 'none' }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div
              className={`px-6 py-4 ${
                warning.severity === 'critical'
                  ? 'bg-red-600'
                  : 'bg-orange-500'
              } text-white`}
            >
              <h2 className="font-bold text-lg">
                {warning.severity === 'critical' ? 'Exam Locked' : 'Violation Detected'}
              </h2>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <p className="text-gray-800 text-center mb-6 font-medium">
                {warning.message}
              </p>

              {warning.severity === 'critical' ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-red-800 text-sm">
                    Your exam has been locked due to policy violations. Please contact your instructor.
                  </p>
                </div>
              ) : (
                <button
                  onClick={dismissWarning}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  I Understand
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lock Screen - Full page overlay when exam is locked */}
      {warning?.severity === 'critical' && (
        <div className="fixed inset-0 z-[9997] bg-gradient-to-br from-red-900 to-red-700 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-6xl mb-6">🔒</div>
            <h1 className="text-4xl font-bold mb-4">Exam Locked</h1>
            <p className="text-xl mb-8">Your session has been flagged for policy violations</p>
            <p className="text-lg text-red-100">
              Please contact your instructor for more information
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ProctoringOverlay;
