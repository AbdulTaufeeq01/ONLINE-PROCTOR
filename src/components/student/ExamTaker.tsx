'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNoiseDetection } from '@/hooks/useNoiseDetection';
import NoiseWarning from '@/components/exam/NoiseWarning';

type WebcamStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

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
  started_at: string | null;
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
  eye_tracking_enabled?: boolean;
  phone_detection_enabled?: boolean;
  ai_detection_enabled?: boolean;
  max_tab_switches?: number;
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

export function ExamTaker({ exam, session, questions: initialQuestions, invite }: Props) {
  const maxTabSwitches = exam.max_tab_switches ?? 3;

  const getFullscreenElement = () => {
    if (typeof document === 'undefined') return null;
    return (
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
      null
    );
  };

  const requestFullscreenCrossBrowser = async () => {
    if (typeof document === 'undefined') return;

    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return;
    }

    if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    }
  };

  const syncFullscreenState = () => {
    setIsFullscreenActive(Boolean(getFullscreenElement()));
  };

  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>(session.answers ?? {});
  const answersRef = useRef<Record<string, string>>(session.answers ?? {});

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const actualStartTimeRef = useRef<number | null>(
    session.started_at && session.status === 'in_progress'
      ? new Date(session.started_at).getTime()
      : null
  );

  const calcTimeRemaining = () => {
    if (!actualStartTimeRef.current) return exam.duration_minutes * 60;
    const elapsed = Math.floor((Date.now() - actualStartTimeRef.current) / 1000);
    return Math.max(0, exam.duration_minutes * 60 - elapsed);
  };

  const [timeRemaining, setTimeRemaining] = useState<number>(calcTimeRemaining);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const tabSwitchCountRef = useRef(0);

  const [showWarning, setShowWarning] = useState<string | null>(null);
  // FIX 3: track WHY a warning is showing so we can take action on dismiss
  const [warningType, setWarningType] = useState<'fullscreen_exit' | 'tab_switch' | 'face' | 'other' | null>(null);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  const [examStarted, setExamStarted] = useState(session.status === 'in_progress');
  // FIX 2: ref mirrors examStarted so event listeners never have stale closure values
  const examStartedRef = useRef(session.status === 'in_progress');

  const [examLocked, setExamLocked] = useState(false);

  const [webcamStatus, setWebcamStatus] = useState<WebcamStatus>('idle');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceStatus, setFaceStatus] = useState<string>('Initializing...');

  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTime = useRef<Record<string, number>>({});
  const eventCounts = useRef({ tabSwitches: 0, fullscreenExits: 0, faceEvents: 0 });
  const consecutiveMissesRef = useRef(0);
  const phoneSuspicionStreakRef = useRef(0);
  const tabHiddenRef = useRef(false);

  // FIX 2: store the tab-switch warning message here while tab is hidden,
  // then apply it to state only when the user returns to the tab.
  const pendingTabWarningRef = useRef<string | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    syncFullscreenState();
    if (typeof document === 'undefined') return;

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    document.addEventListener('fullscreenerror', syncFullscreenState);
    document.addEventListener('webkitfullscreenerror', syncFullscreenState as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
      document.removeEventListener('fullscreenerror', syncFullscreenState);
      document.removeEventListener('webkitfullscreenerror', syncFullscreenState as EventListener);
    };
  }, []);

  useEffect(() => {
    setShuffledQuestions(
      exam.shuffle_questions ? shuffleArray(initialQuestions) : initialQuestions
    );
  }, [exam.shuffle_questions, initialQuestions]);

  const {
    warningCount: noiseWarningCount,
    isLocked: noiseIsLocked,
    showWarning: noiseShowWarning,
    dismiss: dismissNoiseWarning,
    lastNoiseType,
  } = useNoiseDetection({
    sessionId: session.id,
    examId: exam.id,
    studentId: session.student_id,
    enabled: examStarted,
    volumeThreshold: 40,
    cooldownSeconds: 4,
    onLock: () => {
      setExamLocked(true);
    },
  });

  const inputsDisabled = examLocked || noiseIsLocked || isSubmitting;

  // ── Start exam ─────────────────────────────────────────────────────────────
  const handleStartExam = async () => {
    setIsStarting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const now = new Date().toISOString();

      const { error } = await (supabase.from('exam_sessions') as any)
        .update({ status: 'in_progress', started_at: now })
        .eq('id', session.id);

      if (error) {
        console.error('Failed to start session:', error);
        setIsStarting(false);
        alert('Failed to start exam. Please refresh and try again.');
        return;
      }

      actualStartTimeRef.current = new Date(now).getTime();
      setTimeRemaining(exam.duration_minutes * 60);

      if (exam.fullscreen_required) {
        try {
          console.log('[proctoring] 📲 Requesting initial fullscreen...');
          await requestFullscreenCrossBrowser();
          syncFullscreenState();
          console.log('[proctoring] ✅ Initial fullscreen granted');
        } catch (err) {
          console.warn('[proctoring] ⚠️ Initial fullscreen request denied:', err);
          // Non-fatal — user may have denied; fullscreen enforcer will warn them
        }
      }

      // Keep ref in sync so event-listener closures always see the live value
      examStartedRef.current = true;
      setExamStarted(true);
    } catch (err) {
      console.error('Start exam error:', err);
      setIsStarting(false);
      alert('Network error. Please try again.');
    }
  };

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examStarted) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      const remaining = calcTimeRemaining();
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current!);
        handleSubmit();
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [examStarted]);

  // ── Log behavior / flag event (debounced per event type) ──────────────────
  const logBehaviorEvent = useCallback(
    async (event_type: string, confidence: number, metadata: object) => {
      const cooldowns: Record<string, number> = {
        tab_switch:      500,
        fullscreen_exit: 5000,
        no_face:         8000,
        multiple_faces:  6000,
        eye_away:        6000,
        copy_paste:      4000,
        copy_attempt:    4000,
        phone_suspected: 10000,
      };

      const now = Date.now();
      const last = lastEventTime.current[event_type] ?? 0;
      const cooldownMs = cooldowns[event_type] ?? 3000;

      if (now - last < cooldownMs) {
        console.log(`[proctoring] ${event_type} SKIPPED (cooldown: ${cooldownMs - (now - last)}ms remaining)`);
        return;
      }

      lastEventTime.current[event_type] = now;

      if (event_type === 'tab_switch') eventCounts.current.tabSwitches++;
      if (event_type === 'fullscreen_exit') eventCounts.current.fullscreenExits++;
      if (['no_face', 'multiple_faces', 'eye_away'].includes(event_type))
        eventCounts.current.faceEvents++;

      console.log(`[proctoring] 📤 Sending ${event_type} event to /api/flag-event (confidence: ${confidence})`, metadata);

      const payload = JSON.stringify({
        session_id: session.id,
        student_id: session.student_id,
        exam_id:    exam.id,
        event_type,
        confidence,
        metadata,
        severity:
          confidence > 0.9 ? 'high' : confidence > 0.7 ? 'medium' : 'low',
      });

      try {
        const body = new Blob([payload], { type: 'application/json' });
        const canBeacon = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';

        if (canBeacon) {
          const beaconSent = navigator.sendBeacon('/api/flag-event', body);
          if (beaconSent) {
            console.log(`[proctoring] ✅ ${event_type} queued via sendBeacon (confidence: ${confidence})`);
            return;
          }
        }

        const response = await fetch('/api/flag-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });

        const data = await response.json();
        if (!response.ok) {
          console.error(`[proctoring] ❌ flag-event API error (${response.status}):`, data);
        } else {
          console.log(`[proctoring] ✅ ${event_type} recorded successfully (confidence: ${confidence})`);
        }
      } catch (error) {
        console.error('[proctoring] ❌ Failed to log behavior event:', error);
      }
    },
    [session.id, session.student_id, exam.id]
  );

  // ── Load face-api models ───────────────────────────────────────────────────
  useEffect(() => {
    if (!exam.webcam_required && !exam.ai_detection_enabled) return;

    const loadModels = async () => {
      try {
        console.log('[FaceAPI] Loading models from /models ...');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        console.log('[FaceAPI] Models loaded successfully');
        setModelsLoaded(true);
      } catch (error) {
        console.error('[FaceAPI] Failed to load models:', error);
        setFaceStatus('Model load failed');
      }
    };

    loadModels();
  }, [exam.webcam_required, exam.ai_detection_enabled]);

  // ── Start webcam ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!exam.webcam_required) return;

    let cancelled = false;

    const initializeWebcam = async () => {
      setWebcamStatus('requesting');
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException) {
          setWebcamStatus(
            err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
              ? 'denied'
              : 'error'
          );
        } else {
          setWebcamStatus('error');
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      let video = webcamVideoRef.current;
      if (!video) {
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise((r) => setTimeout(r, 100));
          if (cancelled) return;
          video = webcamVideoRef.current;
          if (video) break;
        }
      }

      if (!video) {
        console.error('[Webcam] Video element never mounted — giving up');
        setWebcamStatus('error');
        return;
      }

      video.srcObject = stream;
      video.load();

      try {
        await new Promise<void>((resolve, reject) => {
          const onMeta = () => resolve();
          const onErr  = () => reject(new Error('loadedmetadata error event'));
          const timer  = setTimeout(
            () => reject(new Error('loadedmetadata timed out after 15 s')),
            15_000
          );

          video!.addEventListener('loadedmetadata', () => {
            clearTimeout(timer);
            video!.removeEventListener('error', onErr);
            onMeta();
          }, { once: true });

          video!.addEventListener('error', () => {
            clearTimeout(timer);
            video!.removeEventListener('loadedmetadata', onMeta);
            onErr();
          }, { once: true });
        });
      } catch (err) {
        if (!cancelled) {
          console.error('[Webcam] Metadata wait failed:', err);
          setWebcamStatus('error');
        }
        return;
      }

      if (cancelled) return;

      try {
        await video.play();
        console.log('[Webcam] Stream active, videoWidth:', video.videoWidth);
        setWebcamStatus('active');
      } catch (err) {
        console.error('[Webcam] play() failed:', err);
        if (!cancelled) setWebcamStatus('error');
      }
    };

    initializeWebcam();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [exam.webcam_required]);

  // ── Face detection ─────────────────────────────────────────────────────────
  // FIX 1: Interval reduced from 2000ms → 500ms.
  // With 3 consecutive misses required, face absence is now detected in
  // ~1.5 seconds instead of the original ~6 seconds.
  useEffect(() => {
    if (!modelsLoaded || webcamStatus !== 'active') return;

    console.log('[FaceAPI] Detection loop starting');
    setFaceStatus('Monitoring active');

    const runDetection = async () => {
      const video = webcamVideoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      try {
        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 })
          )
          .withFaceLandmarks();

        const canvas = canvasRef.current;
        if (canvas && video.videoWidth > 0) {
          const dims = { width: video.videoWidth, height: video.videoHeight };
          canvas.width  = dims.width;
          canvas.height = dims.height;
          const resized = faceapi.resizeResults(detections, dims);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawFaceLandmarks(canvas, resized);
          }
        }

        if (detections.length === 0) {
          consecutiveMissesRef.current += 1;
          // 3 misses × 500ms interval = flag fires in ~1.5s
          if (consecutiveMissesRef.current >= 3) {
            setFaceStatus('⚠️ No face detected');
            logBehaviorEvent('no_face', 0.9, {
              consecutive_misses: consecutiveMissesRef.current,
            });
            if (consecutiveMissesRef.current === 3) {
              setWarningType('face');
              setShowWarning('⚠️ No face detected! Please stay in front of the camera.');
            }
          } else {
            setFaceStatus('⚠️ Checking...');
          }
          return;
        }

        consecutiveMissesRef.current = 0;

        if (detections.length > 1) {
          setFaceStatus(`⚠️ ${detections.length} faces detected`);
          logBehaviorEvent('multiple_faces', 0.95, { faceCount: detections.length });
          setWarningType('face');
          setShowWarning('⚠️ Multiple faces detected! Only you should be visible.');
          return;
        }

        setFaceStatus('✓ Face detected');

        if (exam.eye_tracking_enabled) {
          const landmarks = detections[0].landmarks;
          const leftEye   = landmarks.getLeftEye();
          const rightEye  = landmarks.getRightEye();
          const eyeRatio  = (eye: faceapi.Point[]) => {
            const minX    = Math.min(...eye.map((p) => p.x));
            const maxX    = Math.max(...eye.map((p) => p.x));
            const centerX = eye.reduce((s, p) => s + p.x, 0) / eye.length;
            return maxX === minX ? 0.5 : (centerX - minX) / (maxX - minX);
          };
          const avgRatio = (eyeRatio(leftEye) + eyeRatio(rightEye)) / 2;
          if (avgRatio < 0.25 || avgRatio > 0.75) {
            setFaceStatus('⚠️ Eyes away from screen');
            logBehaviorEvent('eye_away', 0.8, { gazeRatio: avgRatio });
            setWarningType('face');
            setShowWarning('⚠️ Please keep your eyes on the screen.');
          }
        }

        if (exam.phone_detection_enabled) {
          const landmarks = detections[0].landmarks;
          const nose      = landmarks.getNose();
          const jaw       = landmarks.getJawOutline();
          const noseTip   = nose[nose.length - 1];
          const chin      = jaw[Math.floor(jaw.length / 2)];
          const dx        = Math.abs(chin.x - noseTip.x);
          const dy        = Math.abs(chin.y - noseTip.y);
          const tiltAngle = Math.atan2(dx, dy) * (180 / Math.PI);

          // Reduce false positives: require sustained tilt before flagging.
          if (tiltAngle > 35) {
            phoneSuspicionStreakRef.current += 1;
          } else {
            phoneSuspicionStreakRef.current = 0;
          }

          if (phoneSuspicionStreakRef.current >= 5) {
            logBehaviorEvent(
              'phone_suspected',
              Math.min(0.95, 0.5 + tiltAngle / 100),
              {
                tiltAngle: Math.round(tiltAngle),
                sustained_frames: phoneSuspicionStreakRef.current,
              }
            );
            phoneSuspicionStreakRef.current = 0;
          }
        }
      } catch (error) {
        console.error('[FaceAPI] Detection error:', error);
      }
    };

    runDetection();
    // FIX 1: Was 2000ms — now 500ms for ~1.5s detection time (3 misses × 500ms)
    detectionIntervalRef.current = setInterval(runDetection, 500);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [modelsLoaded, webcamStatus, exam.eye_tracking_enabled, exam.phone_detection_enabled, logBehaviorEvent]);

  // ── Tab switch detection ───────────────────────────────────────────────────
  // FIX 2: The original code called setShowWarning() while the tab was hidden.
  // Browsers defer or discard React renders for hidden tabs, so the modal
  // never appeared when the user returned.
  //
  // Fix: write the warning message to a ref while the tab is hidden, then
  // read the ref and set state the moment the tab becomes visible again.
  // This guarantees the modal is rendered in the same tick as the user's return.
  //
  // Also removed `examStarted` from deps (stale-closure risk) and replaced
  // it with examStartedRef so the listener never needs to be re-registered.
  useEffect(() => {
    const registerTabSwitchEvent = (source: 'visibility' | 'blur') => {
      if (!examStartedRef.current) return;

      // Count each transition to hidden only once until the page becomes visible again.
      if (tabHiddenRef.current) return;
      tabHiddenRef.current = true;

      tabSwitchCountRef.current += 1;
      const newCount = tabSwitchCountRef.current;
      setTabSwitchCount(newCount);
      console.log(`[proctoring] ⚠️ TAB SWITCH DETECTED via ${source}! Count: ${newCount}/${maxTabSwitches}`);
      logBehaviorEvent('tab_switch', 0.95, { count: newCount, source });

      pendingTabWarningRef.current =
        newCount >= maxTabSwitches
          ? `⚠️ You have switched tabs ${newCount} times. Your exam may be auto-submitted!`
          : `⚠️ Tab switch detected! (${newCount}/${maxTabSwitches} allowed). Stay on this page.`;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // ── Tab is now visible again ──────────────────────────────────────
        console.log('[proctoring] 👁️ Tab returned to focus');
        tabHiddenRef.current = false;
        // Apply any warning that was queued while the tab was hidden.
        if (pendingTabWarningRef.current) {
          setWarningType('tab_switch');
          setShowWarning(pendingTabWarningRef.current);
          pendingTabWarningRef.current = null;
        }
        return;
      }

      // ── Tab just went hidden ──────────────────────────────────────────────
      registerTabSwitchEvent('visibility');
    };

    const handleWindowBlur = () => {
      registerTabSwitchEvent('blur');
    };

    const handleWindowFocus = () => {
      tabHiddenRef.current = false;
      if (pendingTabWarningRef.current) {
        setWarningType('tab_switch');
        setShowWarning(pendingTabWarningRef.current);
        pendingTabWarningRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
    // examStarted intentionally omitted — we use examStartedRef to avoid
    // re-registering the listener on every exam-start state change.
  }, [logBehaviorEvent, maxTabSwitches]);

  // ── Fullscreen enforcement ─────────────────────────────────────────────────
  // FIX 3: The original code called requestFullscreen() inside the
  // fullscreenchange event handler. Browsers block programmatic fullscreen
  // requests that are not triggered by a direct user gesture, so the call
  // silently failed and the student was never put back into fullscreen.
  //
  // Fix: show the warning modal, then request fullscreen inside the
  // "I Understand" button's onClick — that click IS a user gesture and the
  // browser will honour the request.
  //
  // FIX 4: Added webkit prefixes for Safari support. Safari requires
  // webkitfullscreenchange event and webkitFullscreenElement property.
  useEffect(() => {
    if (!examStarted || !exam.fullscreen_required) return;

    const handleFullscreenChange = () => {
      // Check for fullscreen in cross-browser way (both standard and webkit)
      const isFullscreen = Boolean(getFullscreenElement());
      setIsFullscreenActive(isFullscreen);
      
      if (!isFullscreen) {
        console.log('[proctoring] ❌ FULLSCREEN EXITED - Flagging violation');
        logBehaviorEvent('fullscreen_exit', 0.9, {});
        // Tag the warning so the dismiss handler knows to re-enter fullscreen
        setWarningType('fullscreen_exit');
        setShowWarning(
          '⚠️ You exited fullscreen mode! Click "Return to Fullscreen" to continue your exam.'
        );
      } else {
        console.log('[proctoring] ✅ Fullscreen re-entered');
      }
    };

    // Listen for both standard and webkit fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [examStarted, exam.fullscreen_required, logBehaviorEvent]);

  // ── Dismiss warning — FIX 3 continued ─────────────────────────────────────
  // Centralised dismiss handler so we can take type-specific action.
  const handleDismissWarning = useCallback(() => {
    if (warningType === 'fullscreen_exit' && exam.fullscreen_required) {
      // This is called from a click handler → valid user gesture → fullscreen works
      // FIX 4: Try both standard and webkit methods for cross-browser support
      console.log('[proctoring] 📲 Requesting fullscreen re-entry...');
      requestFullscreenCrossBrowser()
        .then(() => {
          syncFullscreenState();
          console.log('[proctoring] ✅ Fullscreen re-entered successfully');
        })
        .catch((err) => {
          console.warn('[proctoring] ❌ Fullscreen re-entry failed:', err);
          syncFullscreenState();
        });
    }
    setShowWarning(null);
    setWarningType(null);
  }, [warningType, exam.fullscreen_required]);

  // ── Copy/paste prevention ──────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logBehaviorEvent('copy_paste', 0.85, {
        pastedText: e.clipboardData?.getData('text')?.slice(0, 100),
      });
      setWarningType('other');
      setShowWarning('⚠️ Copy-paste is not allowed during the exam!');
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

  // ── Cheating score ─────────────────────────────────────────────────────────
  const calculateCheatingScore = (): number => {
    const { tabSwitches, fullscreenExits, faceEvents } = eventCounts.current;
    const noiseWarnings = noiseWarningCount;
    return Math.min(
      1,
      Math.min(1, tabSwitches / 5)     * 0.35 +
      Math.min(1, fullscreenExits / 3)  * 0.25 +
      Math.min(1, faceEvents / 10)      * 0.25 +
      Math.min(1, noiseWarnings / 5)    * 0.15
    );
  };

  // ── Submit exam ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Set examStarted to false FIRST to prevent listeners from registering tab switches during submission
    examStartedRef.current = false;
    
    // Then stop the intervals
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    try {
      const response = await fetch('/api/grade-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:     session.id,
          user_id:        session.student_id,
          answers:        answersRef.current,
          cheating_score: calculateCheatingScore(),
        }),
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

  // ── Derived UI values ──────────────────────────────────────────────────────
  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  const minutes   = Math.floor(timeRemaining / 60);
  const seconds   = timeRemaining % 60;
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const getTimerColor = () => {
    if (timeRemaining > 5 * 60) return 'text-green-400';
    if (timeRemaining > 60)     return 'text-yellow-400';
    return 'text-red-400';
  };

  // ── Pre-exam screen ────────────────────────────────────────────────────────
  if (!examStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white p-8 rounded-lg bg-gray-800 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold mb-2">{exam.title}</h2>
          <p className="text-gray-400 mb-1">Duration: {exam.duration_minutes} minutes</p>
          <p className="text-gray-400 mb-1">Questions: {shuffledQuestions.length}</p>
          <p className="text-gray-500 text-sm mb-6">
            {exam.fullscreen_required ? 'This exam requires fullscreen mode. ' : ''}
            {exam.webcam_required ? 'Your webcam will be monitored. ' : ''}
            Once you click Enter Exam, the timer starts.
          </p>
          <button
            onClick={handleStartExam}
            disabled={isStarting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold text-lg w-full transition-colors"
          >
            {isStarting ? 'Starting...' : 'Enter Exam'}
          </button>
        </div>
      </div>
    );
  }

  // ── Main exam UI ───────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-gray-900 text-white">
      {(examLocked || noiseIsLocked) && (
        <div className="bg-red-700 text-white text-center py-2 px-4 text-sm font-semibold z-40">
          🔒 Your exam has been locked due to noise violations. Contact your proctor to continue.
        </div>
      )}

      {/* Top Bar */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{exam.title}</h1>
          <div className={`text-3xl font-mono font-bold ${getTimerColor()}`}>{timerText}</div>
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
                      ({currentQuestion?.marks} mark
                      {currentQuestion?.marks !== 1 ? 's' : ''})
                    </span>
                  </p>
                  <h2 className="text-xl font-semibold text-white mb-6">
                    {currentQuestion?.question_text}
                  </h2>

                  {/* MCQ */}
                  {currentQuestion?.type === 'mcq' && (
                    <div className="space-y-3">
                      {(currentQuestion.options ?? []).length === 0 ? (
                        <p className="text-red-400 text-sm">No options available.</p>
                      ) : (
                        (currentQuestion.options ?? []).map((option: string, idx: number) => (
                          <button
                            key={idx}
                            disabled={inputsDisabled}
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [currentQuestion.id]: option,
                              }))
                            }
                            className={`w-full text-left p-4 rounded-lg border transition-colors
                              ${inputsDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                              ${
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
                      disabled={inputsDisabled}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentQuestion.id]: e.target.value,
                        }))
                      }
                      placeholder={
                        inputsDisabled
                          ? 'Exam locked — inputs disabled.'
                          : 'Type your answer here...'
                      }
                      className={`w-full p-4 rounded-lg bg-gray-700 border border-gray-600 text-white
                        placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none
                        ${inputsDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        ${currentQuestion.type === 'long_answer' ? 'h-64' : 'h-32'}`}
                    />
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Webcam + Navigator Panel */}
        <div className="w-72 border-l border-gray-700 bg-gray-800 p-4 flex flex-col gap-4">
          {exam.webcam_required && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Live Feed</p>
              <div
                className="relative w-full rounded-lg overflow-hidden bg-gray-900"
                style={{ height: '200px' }}
              >
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
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
                <p
                  className={`text-xs mt-2 ${
                    faceStatus.startsWith('⚠️')
                      ? 'text-yellow-400'
                      : faceStatus.startsWith('✓')
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {modelsLoaded ? faceStatus : '⏳ Loading AI models...'}
                </p>
              )}
            </div>
          )}

          {noiseWarningCount > 0 && (
            <div className="rounded-lg bg-yellow-900/40 border border-yellow-700 px-3 py-2">
              <p className="text-xs text-yellow-400 font-medium">
                🔊 Noise warnings: {noiseWarningCount}/5
              </p>
              {lastNoiseType && (
                <p className="text-xs text-yellow-500 mt-0.5 capitalize">
                  Last: {lastNoiseType.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          )}

          {/* Tab Switch Counter */}
          {tabSwitchCount > 0 && (
            <div className="rounded-lg bg-orange-900/40 border border-orange-700 px-3 py-2">
              <p className="text-xs text-orange-400 font-medium">
                🔄 Tab switches: {tabSwitchCount}/{maxTabSwitches}
              </p>
              <p className="text-xs text-orange-500 mt-0.5">
                {tabSwitchCount >= maxTabSwitches ? '⚠️ Exam may be auto-submitted!' : 'Stay focused!'}
              </p>
            </div>
          )}

          {/* Fullscreen Status */}
          {exam.fullscreen_required && (
            <div className={`rounded-lg px-3 py-2 border ${
              isFullscreenActive
                ? 'bg-green-900/40 border-green-700'
                : 'bg-red-900/40 border-red-700'
            }`}>
              <p className={`text-xs font-medium ${
                isFullscreenActive
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {isFullscreenActive
                  ? '✅ Fullscreen active'
                  : '❌ Not in fullscreen'}
              </p>
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
            disabled={currentQuestionIndex === 0 || inputsDisabled}
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
              disabled={inputsDisabled}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Exam'}
            </Button>
          ) : (
            <Button
              onClick={() =>
                setCurrentQuestionIndex((i) => Math.min(shuffledQuestions.length - 1, i + 1))
              }
              disabled={inputsDisabled}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </Button>
          )}
        </div>
      </div>

      {/* ── Proctoring warning modal ─────────────────────────────────────────
          FIX 3: Button label and onClick now vary by warningType.
          For fullscreen_exit, the click IS a user gesture so requestFullscreen()
          succeeds. For all other types it just dismisses. */}
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <Card className="w-full max-w-md bg-gray-800 border-gray-700 p-8">
            <h2 className="mb-4 text-xl font-bold text-red-400">⚠️ Warning</h2>
            <p className="mb-6 text-gray-200">{showWarning}</p>
            <Button onClick={handleDismissWarning} className="w-full">
              {warningType === 'fullscreen_exit'
                ? 'Return to Fullscreen'
                : 'I Understand'}
            </Button>
          </Card>
        </div>
      )}

      {/* Noise warning overlay */}
      {noiseShowWarning && (
        <NoiseWarning
          warningCount={noiseWarningCount}
          noiseType={lastNoiseType ?? null}
          onDismiss={dismissNoiseWarning}
        />
      )}
    </div>
  );
}