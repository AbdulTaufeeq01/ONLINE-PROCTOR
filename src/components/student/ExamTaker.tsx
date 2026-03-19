'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Question {
  id: string;
  question_text: string;
  type: string;
  options: string[] | null;
  marks: number;
  order_index: number;
}

interface Session {
  id: string;
  student_id: string;
  started_at: string;
  status: string;
  answers: Record<string, string> | null;
}

interface Exam {
  id: string;
  title: string;
  duration_minutes: number;
  webcam_required: boolean;
  fullscreen_required: boolean;
  shuffle_questions: boolean;
  eye_tracking_enabled: boolean;
  phone_detection_enabled: boolean;
  ai_detection_enabled: boolean;
  max_tab_switches: number;
}

interface Invite {
  id: string;
  student_name: string;
  student_email: string;
}

interface Props {
  exam: Exam;
  session: Session;
  questions: Question[];
  invite: Invite;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function ExamTaker({
  exam,
  session,
  questions: initialQuestions,
  invite,
}: Props) {
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>(session.answers ?? {});
  const answersRef = useRef<Record<string, string>>(session.answers ?? {});

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const startedAt = new Date(session.started_at).getTime();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    return Math.max(0, exam.duration_minutes * 60 - elapsed);
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);

  // Webcam states
  const [webcamStatus, setWebcamStatus] = useState<
    'idle' | 'requesting' | 'active' | 'denied' | 'error'
  >('idle');

  // Face detection states
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceStatus, setFaceStatus] = useState<string>('Initializing...');

  // Single video ref — used for BOTH display and face detection
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounce: track last time each event type was fired
  const lastEventTime = useRef<Record<string, number>>({});

  // Event counters for cheating score
  const eventCounts = useRef({
    tabSwitches: 0,
    fullscreenExits: 0,
    faceEvents: 0,
    audioSpikes: 0,
  });

  // Keep answersRef in sync
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Shuffle questions on mount
  useEffect(() => {
    setShuffledQuestions(
      exam.shuffle_questions ? shuffleArray(initialQuestions) : initialQuestions
    );
  }, [exam.shuffle_questions, initialQuestions]);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const calc = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / 1000
      );
      return Math.max(0, exam.duration_minutes * 60 - elapsed);
    };

    setTimeRemaining(calc());

    const interval = setInterval(() => {
      const remaining = calc();
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleSubmit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ── Log behavior event (with debounce) ───────────────────────────────────
  const logBehaviorEvent = useCallback(async (
    event_type: string,
    confidence: number,
    metadata: object
  ) => {
    // Debounce cooldowns per event type
    const cooldowns: Record<string, number> = {
      tab_switch: 3000,
      fullscreen_exit: 5000,
      no_face: 8000,
      multiple_faces: 6000,
      eye_away: 6000,
      copy_paste: 4000,
      copy_attempt: 4000,
      phone_suspected: 10000,
    };

    const now = Date.now();
    const last = lastEventTime.current[event_type] ?? 0;
    if (now - last < (cooldowns[event_type] ?? 3000)) return;
    lastEventTime.current[event_type] = now;

    // Increment counters for cheating score
    if (event_type === 'tab_switch') eventCounts.current.tabSwitches++;
    if (event_type === 'fullscreen_exit') eventCounts.current.fullscreenExits++;
    if (['no_face', 'multiple_faces', 'eye_away'].includes(event_type))
      eventCounts.current.faceEvents++;

    console.log(`[Behavior] ${event_type} confidence=${confidence}`);

    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          student_id: session.student_id,
          exam_id: exam.id,
          event_type,
          confidence,
          metadata,
          severity: confidence > 0.9 ? 'high' : confidence > 0.7 ? 'medium' : 'low',
        }),
      });
    } catch (error) {
      console.error('Failed to log behavior event:', error);
    }
  }, [session.id, session.student_id, exam.id]);

  // ── Step 1: Load face-api models ─────────────────────────────────────────
  useEffect(() => {
    if (!exam.webcam_required && !exam.ai_detection_enabled) return;

    const loadModels = async () => {
      try {
        console.log('[FaceAPI] Loading models...');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        setModelsLoaded(true);
        console.log('[FaceAPI] Models loaded successfully');
      } catch (error) {
        console.error('[FaceAPI] Failed to load models:', error);
        setFaceStatus('Model load failed');
      }
    };

    loadModels();
  }, [exam.webcam_required, exam.ai_detection_enabled]);

  // ── Step 2: Start webcam ─────────────────────────────────────────────────
  useEffect(() => {
    if (!exam.webcam_required) return;

    const initializeWebcam = async () => {
      setWebcamStatus('requesting');
      console.log('[Webcam] Requesting camera access...');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });

        streamRef.current = stream;

        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;

          // Wait for video to actually be ready before marking active
          webcamVideoRef.current.onloadedmetadata = () => {
            webcamVideoRef.current!.play()
              .then(() => {
                console.log('[Webcam] Video playing, ready for detection');
                setWebcamStatus('active');
              })
              .catch((err) => {
                console.error('[Webcam] Play failed:', err);
                setWebcamStatus('error');
              });
          };
        }
      } catch (err) {
        console.error('[Webcam] Access error:', err);
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setWebcamStatus('denied');
          } else {
            setWebcamStatus('error');
          }
        } else {
          setWebcamStatus('error');
        }
      }
    };

    initializeWebcam();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [exam.webcam_required]);

  // ── Step 3: Start face detection ONLY after BOTH models AND webcam ready ─
  useEffect(() => {
    // Both conditions must be true before starting detection
    if (!modelsLoaded || webcamStatus !== 'active') {
      console.log(
        `[FaceAPI] Waiting — modelsLoaded=${modelsLoaded} webcamStatus=${webcamStatus}`
      );
      return;
    }

    console.log('[FaceAPI] Starting detection interval');
    setFaceStatus('Monitoring active');

    const runDetection = async () => {
      const video = webcamVideoRef.current;

      // Guard: video must be playing and have dimensions
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        console.log('[FaceAPI] Video not ready yet, skipping frame');
        return;
      }

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.4,
          }))
          .withFaceLandmarks();

        console.log(`[FaceAPI] Detected ${detections.length} face(s)`);

        // Draw on canvas overlay
        const canvas = canvasRef.current;
        if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
          const dims = {
            width: video.videoWidth,
            height: video.videoHeight,
          };
          canvas.width = dims.width;
          canvas.height = dims.height;
          const resized = faceapi.resizeResults(detections, dims);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawFaceLandmarks(canvas, resized);
          }
        }

        if (detections.length === 0) {
          setFaceStatus('⚠️ No face detected');
          logBehaviorEvent('no_face', 0.9, {});
          setShowWarning('No face detected! Please stay in front of the camera.');
          return;
        }

        if (detections.length > 1) {
          setFaceStatus(`⚠️ ${detections.length} faces detected`);
          logBehaviorEvent('multiple_faces', 0.95, { faceCount: detections.length });
          setShowWarning('Multiple faces detected! Only you should be visible.');
          return;
        }

        // Single face detected — run eye gaze analysis
        setFaceStatus('✓ Face detected');

        if (exam.eye_tracking_enabled) {
          const landmarks = detections[0].landmarks;
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();

          // Calculate horizontal gaze ratio per eye
          const eyeRatio = (eye: faceapi.Point[]) => {
            const minX = Math.min(...eye.map((p) => p.x));
            const maxX = Math.max(...eye.map((p) => p.x));
            const centerX = eye.reduce((s, p) => s + p.x, 0) / eye.length;
            return maxX === minX ? 0.5 : (centerX - minX) / (maxX - minX);
          };

          const avgRatio = (eyeRatio(leftEye) + eyeRatio(rightEye)) / 2;

          if (avgRatio < 0.25 || avgRatio > 0.75) {
            setFaceStatus('⚠️ Eyes away from screen');
            logBehaviorEvent('eye_away', 0.8, { gazeRatio: avgRatio });
            setShowWarning('Please keep your eyes on the screen.');
          }
        }

        // Phone detection via head tilt
        if (exam.phone_detection_enabled) {
          const landmarks = detections[0].landmarks;
          const nose = landmarks.getNose();
          const jaw = landmarks.getJawOutline();
          const noseTip = nose[nose.length - 1];
          const chin = jaw[Math.floor(jaw.length / 2)];
          const dx = Math.abs(chin.x - noseTip.x);
          const dy = Math.abs(chin.y - noseTip.y);
          const tiltAngle = Math.atan2(dx, dy) * (180 / Math.PI);

          if (tiltAngle > 25) {
            const confidence = Math.min(0.95, 0.5 + tiltAngle / 100);
            logBehaviorEvent('phone_suspected', confidence, {
              tiltAngle: Math.round(tiltAngle),
            });
          }
        }
      } catch (error) {
        console.error('[FaceAPI] Detection error:', error);
      }
    };

    // Run once immediately, then every 2 seconds
    runDetection();
    detectionIntervalRef.current = setInterval(runDetection, 2000);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [modelsLoaded, webcamStatus, exam.eye_tracking_enabled, exam.phone_detection_enabled, logBehaviorEvent]);

  // ── Tab switch detection ──────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => {
          const newCount = prev + 1;
          logBehaviorEvent('tab_switch', 0.95, { count: newCount });
          setShowWarning(
            newCount >= exam.max_tab_switches
              ? `Warning! You have switched tabs ${newCount} times. Exam may be auto-submitted.`
              : `Tab switch detected! (${newCount}/${exam.max_tab_switches} allowed)`
          );
          return newCount;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [logBehaviorEvent, exam.max_tab_switches]);

  // ── Fullscreen enforcement ────────────────────────────────────────────────
  useEffect(() => {
    if (!examStarted || !exam.fullscreen_required) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logBehaviorEvent('fullscreen_exit', 0.9, {});
        setShowWarning('You exited fullscreen! Please click I Understand to return.');
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [examStarted, exam.fullscreen_required, logBehaviorEvent]);

  // ── Copy/paste prevention ─────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logBehaviorEvent('copy_paste', 0.85, {
        pastedText: e.clipboardData?.getData('text')?.slice(0, 100),
      });
      setShowWarning('Copy-paste is not allowed during the exam!');
    };
    const handleCopy = () => logBehaviorEvent('copy_attempt', 0.7, {});
    const handleKeydown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && ['c', 'v', 'x', 'a', 'u', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        logBehaviorEvent(
          e.key.toLowerCase() === 'v' ? 'copy_paste' : 'copy_attempt',
          0.7,
          { key: e.key }
        );
      }
      if (e.key === 'F12' || (ctrl && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        logBehaviorEvent('copy_attempt', 0.9, { trigger: 'devtools_attempt' });
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logBehaviorEvent('copy_attempt', 0.6, { trigger: 'right_click' });
    };

    document.addEventListener('paste', handlePaste);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [logBehaviorEvent]);

  // ── Cheating score calculation ────────────────────────────────────────────
  const calculateCheatingScore = (): number => {
    const { tabSwitches, fullscreenExits, faceEvents, audioSpikes } = eventCounts.current;
    return Math.min(
      1,
      Math.min(1, tabSwitches / 5) * 0.35 +
      Math.min(1, fullscreenExits / 3) * 0.35 +
      Math.min(1, faceEvents / 10) * 0.20 +
      Math.min(1, audioSpikes / 8) * 0.10
    );
  };

  // ── Submit exam ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Stop detection on submit
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    try {
      const payload = {
        session_id: session.id,
        exam_id: exam.id,
        answers: answersRef.current,
        cheating_score: calculateCheatingScore(),
      };

      const response = await fetch('/api/submit-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        window.location.href = `/student/results/${session.id}`;
      } else {
        const errorText = await response.text();
        console.error('Submit failed:', response.status, errorText);
        setIsSubmitting(false);
        alert('Failed to submit exam. Please try again.');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setIsSubmitting(false);
      alert('Network error. Please try again.');
    }
  };

  // ── Derived UI values ─────────────────────────────────────────────────────
  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const getTimerColor = () => {
    if (timeRemaining > 5 * 60) return 'text-green-400';
    if (timeRemaining > 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // ── Pre-exam screen ───────────────────────────────────────────────────────
  if (!examStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white p-8 rounded-lg bg-gray-800 max-w-md">
          <h2 className="text-2xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-gray-400 mb-6">
            {exam.fullscreen_required
              ? 'This exam requires fullscreen mode. '
              : ''}
            Your webcam and behavior will be monitored.
          </p>
          <button
            onClick={async () => {
              if (exam.fullscreen_required) {
                try {
                  await document.documentElement.requestFullscreen();
                } catch {}
              }
              setExamStarted(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-lg"
          >
            Enter Exam
          </button>
        </div>
      </div>
    );
  }

  // ── Main exam UI ──────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gray-900 text-white">
      {/* Top Bar */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{exam.title}</h1>
          <div className={`text-3xl font-mono font-bold ${getTimerColor()}`}>
            {timerText}
          </div>
          <div className="text-sm text-gray-400">
            Q {currentQuestionIndex + 1}/{shuffledQuestions.length}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Questions Panel */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <Card className="bg-gray-800 border-gray-700">
            <div className="p-8">
              {shuffledQuestions.length === 0 ? (
                <p className="text-gray-400">No questions found</p>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-2">
                    Question {currentQuestionIndex + 1} of {shuffledQuestions.length}
                    <span className="ml-4 text-gray-500">
                      ({currentQuestion?.marks} mark{currentQuestion?.marks !== 1 ? 's' : ''})
                    </span>
                  </p>
                  <h2 className="text-xl font-semibold text-white mb-6">
                    {currentQuestion?.question_text}
                  </h2>

                  {/* MCQ Options */}
                  {currentQuestion?.type === 'mcq' && (
                    <div className="space-y-3">
                      {(currentQuestion.options ?? []).length === 0 ? (
                        <p className="text-red-400 text-sm">No options available.</p>
                      ) : (
                        (currentQuestion.options ?? []).map((option: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [currentQuestion.id]: option,
                              }))
                            }
                            className={`w-full text-left p-4 rounded-lg border transition-colors ${
                              answers[currentQuestion.id] === option
                                ? 'border-blue-500 bg-blue-500/20 text-white'
                                : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <span className="font-medium mr-3 text-gray-400">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            {option}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Short / Long Answer */}
                  {(currentQuestion?.type === 'short_answer' ||
                    currentQuestion?.type === 'long_answer') && (
                    <textarea
                      value={answers[currentQuestion?.id] ?? ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: e.target.value,
                        }))
                      }
                      placeholder="Type your answer here..."
                      className={`w-full p-4 rounded-lg bg-gray-700 border border-gray-600
                        text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                        resize-none ${currentQuestion.type === 'long_answer' ? 'h-64' : 'h-32'}`}
                    />
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Webcam Panel */}
        <div className="w-72 border-l border-gray-700 bg-gray-800 p-4 flex flex-col gap-4">
          {exam.webcam_required && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Live Feed</p>

              {/* Video + canvas overlay wrapper */}
              <div className="relative w-full rounded-lg overflow-hidden bg-gray-900"
                style={{ height: '200px' }}>
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Canvas overlays landmarks on top of video */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>

              {/* Status messages */}
              {webcamStatus === 'denied' && (
                <p className="text-red-400 text-xs mt-2">
                  Camera access denied. Allow camera in browser settings.
                </p>
              )}
              {webcamStatus === 'error' && (
                <p className="text-red-400 text-xs mt-2">
                  Camera error. Check your camera is connected.
                </p>
              )}
              {webcamStatus === 'requesting' && (
                <p className="text-gray-400 text-xs mt-2">Starting webcam...</p>
              )}
              {webcamStatus === 'active' && (
                <p className={`text-xs mt-2 ${
                  faceStatus.startsWith('⚠️') ? 'text-yellow-400' :
                  faceStatus.startsWith('✓') ? 'text-green-400' :
                  'text-gray-400'
                }`}>
                  {modelsLoaded ? faceStatus : '⏳ Loading AI models...'}
                </p>
              )}
            </div>
          )}

          {/* Question Navigator */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Questions</p>
            <div className="grid grid-cols-5 gap-1">
              {shuffledQuestions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-full aspect-square rounded text-xs font-medium transition-colors ${
                    idx === currentQuestionIndex
                      ? 'bg-blue-600 text-white'
                      : answers[q.id]
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
                Answered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-700 inline-block" />
                Unanswered
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex justify-between items-center">
          <Button
            onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
            disabled={currentQuestionIndex === 0}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Previous
          </Button>

          <span className="text-sm text-gray-400">
            {Object.keys(answers).length}/{shuffledQuestions.length} answered
          </span>

          {currentQuestionIndex === shuffledQuestions.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Exam'}
            </Button>
          ) : (
            <Button
              onClick={() =>
                setCurrentQuestionIndex((i) =>
                  Math.min(shuffledQuestions.length - 1, i + 1)
                )
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              Next
            </Button>
          )}
        </div>
      </div>

      {/* Warning Overlay */}
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <Card className="w-full max-w-md bg-gray-800 border-gray-700 p-8">
            <h2 className="mb-4 text-xl font-bold text-red-400">Warning</h2>
            <p className="mb-6 text-gray-200">{showWarning}</p>
            <Button onClick={() => setShowWarning(null)} className="w-full">
              I Understand
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}