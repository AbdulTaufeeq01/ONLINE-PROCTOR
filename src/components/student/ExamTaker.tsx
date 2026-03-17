'use client';

import { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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
  const [shuffledQuestions, setShuffledQuestions] =
    useState<Question[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>(
    session.answers ?? {}
  );
  const answersRef = useRef<Record<string, string>>(session.answers ?? {});

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const startedAt = new Date(session.started_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startedAt) / 1000);
    const total = exam.duration_minutes * 60;
    return Math.max(0, total - elapsed);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarning, setShowWarning] = useState<string | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [webcamReady, setWebcamReady] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [noFaceCount, setNoFaceCount] = useState(0);
  const [multipleFaceCount, setMultipleFaceCount] = useState(0);
  const [eyeAwayCount, setEyeAwayCount] = useState(0);
  const [examStarted, setExamStarted] = useState(false);

  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<any>(null);

  // Keep answersRef in sync with state
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Shuffle questions on mount
  useEffect(() => {
    if (exam.shuffle_questions) {
      setShuffledQuestions(shuffleArray(initialQuestions));
    } else {
      setShuffledQuestions(initialQuestions);
    }
  }, [exam.shuffle_questions, initialQuestions]);

  // Timer countdown
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

  // Webcam initialization
  useEffect(() => {
    if (!exam.webcam_required) return;

    const initializeWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        });
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.onloadedmetadata = () => {
            webcamVideoRef.current?.play()
              .then(() => {
                setWebcamReady(true);
              })
              .catch((err) => {
                setWebcamError('Could not play webcam stream.');
                console.error('Webcam play error:', err);
              });
          };
        }
      } catch (err) {
        console.error('Webcam error:', err);
        let errorMessage = 'Could not access webcam. Please allow camera access.';
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Camera access denied. Please allow camera access in your browser settings.';
          } else if (err.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please connect a camera.';
          } else {
            errorMessage = 'Could not access webcam: ' + err.message;
          }
        }
        setWebcamError(errorMessage);
      }
    };

    initializeWebcam();

    return () => {
      if (webcamVideoRef.current?.srcObject) {
        (webcamVideoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, [exam.webcam_required]);

  // Face detection initialization
  useEffect(() => {
    const initializeFaceDetection = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');
        setFaceApiLoaded(true);

        if (!webcamVideoRef.current?.srcObject) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        }

        if (exam.eye_tracking_enabled || exam.phone_detection_enabled) {
          detectionIntervalRef.current = setInterval(
            () => runFaceDetection(),
            3000
          );
        }
      } catch (error) {
        console.error('Failed to initialize face detection:', error);
      }
    };

    initializeFaceDetection();

    return () => {
      if (detectionIntervalRef.current)
        clearInterval(detectionIntervalRef.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, [exam.eye_tracking_enabled, exam.phone_detection_enabled]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => {
          const newCount = prev + 1;
          logBehaviorEvent('tab_switch', 0.95, { count: newCount });
          if (newCount >= exam.max_tab_switches) {
            setShowWarning(
              `Warning! You have switched tabs ${newCount} times. Exam may be auto-submitted.`
            );
          } else {
            setShowWarning(
              `Tab switch detected! (${newCount}/${exam.max_tab_switches} allowed)`
            );
          }
          return newCount;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fullscreen enforcement
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
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [examStarted, exam.fullscreen_required]);

  // Copy-paste prevention
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logBehaviorEvent('copy_paste', 0.85, {
        pastedText: e.clipboardData?.getData('text')?.slice(0, 100),
      });
      setShowWarning('Copy-paste is not allowed during the exam!');
    };
    const handleCopy = () => logBehaviorEvent('copy_attempt', 0.7, {});
    document.addEventListener('paste', handlePaste);
    document.addEventListener('copy', handleCopy);
    return () => {
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);

  // Face detection logic
  const runFaceDetection = async () => {
    const detectionVideo = webcamVideoRef.current || videoRef.current;
    if (!detectionVideo || !faceApiLoaded) return;

    try {
      const detections = await faceapi
        .detectAllFaces(detectionVideo, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (detections.length === 0) {
        setNoFaceCount((prev) => {
          const newCount = prev + 1;
          if (newCount % 3 === 0) {
            logBehaviorEvent('no_face', 0.9, { count: newCount });
            setShowWarning('No face detected! Please stay in front of the camera.');
          }
          return newCount;
        });
        return;
      }

      if (detections.length > 1) {
        setMultipleFaceCount((prev) => {
          const newCount = prev + 1;
          if (newCount % 3 === 0) {
            logBehaviorEvent('multiple_faces', 0.95, { count: newCount });
            setShowWarning('Multiple faces detected! Only you should be visible.');
          }
          return newCount;
        });
        return;
      }

      const landmarks = detections[0].landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyeCenterX =
        (leftEye.reduce((s, p) => s + p.x, 0) +
          rightEye.reduce((s, p) => s + p.x, 0)) /
        (leftEye.length + rightEye.length);
      const faceBox = detections[0].detection.box;
      const relativeEyeX = (eyeCenterX - faceBox.x) / faceBox.width;

      if (relativeEyeX < 0.2 || relativeEyeX > 0.8) {
        setEyeAwayCount((prev) => {
          const newCount = prev + 1;
          if (newCount % 3 === 0) {
            logBehaviorEvent('eye_away', 0.8, { count: newCount });
            setShowWarning('Please keep your eyes on the screen.');
          }
          return newCount;
        });
      }
    } catch (error) {
      console.error('Face detection error:', error);
    }
  };

  // Log behavior event
  const logBehaviorEvent = async (
    event_type: string,
    confidence: number,
    metadata: object
  ) => {
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
          severity:
            confidence > 0.9 ? 'high' : confidence > 0.7 ? 'medium' : 'low',
        }),
      });
    } catch (error) {
      console.error('Failed to log behavior event:', error);
    }
  };

  // Submit exam — uses answersRef to avoid stale closure
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        session_id: session.id,
        exam_id: exam.id,
        answers: answersRef.current,
      };
      console.log('submit payload:', JSON.stringify(payload));
      
      const response = await fetch('/api/submit-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        window.location.href = `/student/results/${session.id}`;
      } else {
        const errorText = await response.text();
        console.error('Submit failed with status:', response.status);
        console.error('Error response:', errorText);
        setIsSubmitting(false);
        alert('Failed to submit exam. Please try again.');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setIsSubmitting(false);
      alert('Network error. Please try again.');
    }
  };

  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const getTimerColor = () => {
    if (timeRemaining > 5 * 60) return 'text-green-400';
    if (timeRemaining > 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!examStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white p-8 rounded-lg bg-gray-800 max-w-md">
          <h2 className="text-2xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-gray-400 mb-6">
            This exam requires fullscreen mode. Your webcam and behavior will
            be monitored.
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

  return (
    <div className="flex min-h-screen flex-col bg-gray-900 text-white">
      {/* Hidden video/canvas for face detection */}
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

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
                    Question {currentQuestionIndex + 1} of{' '}
                    {shuffledQuestions.length}
                    <span className="ml-4 text-gray-500">
                      ({currentQuestion?.marks} mark
                      {currentQuestion?.marks !== 1 ? 's' : ''})
                    </span>
                  </p>
                  <h2 className="text-xl font-semibold text-white mb-6">
                    {currentQuestion?.question_text}
                  </h2>

                  {/* MCQ Options */}
                  {currentQuestion?.type === 'mcq' && (
                    <div className="space-y-3">
                      {(currentQuestion.options ?? []).length === 0 ? (
                        <p className="text-red-400 text-sm">
                          No options available for this question.
                        </p>
                      ) : (
                        (currentQuestion.options ?? []).map(
                          (option: string, idx: number) => (
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
                          )
                        )
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
                        resize-none ${
                          currentQuestion.type === 'long_answer'
                            ? 'h-64'
                            : 'h-32'
                        }`}
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
              <video
                ref={webcamVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded-lg bg-gray-900"
                style={{ height: '200px', objectFit: 'cover' }}
              />
              {webcamError && (
                <p className="text-red-400 text-sm mt-2">{webcamError}</p>
              )}
              {!webcamReady && !webcamError && (
                <p className="text-gray-400 text-sm mt-2">
                  Starting webcam...
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
            onClick={() =>
              setCurrentQuestionIndex((i) => Math.max(0, i - 1))
            }
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