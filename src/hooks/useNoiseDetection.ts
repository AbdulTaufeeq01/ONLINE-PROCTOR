'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface NoiseDetectionState {
  isListening: boolean;
  warningCount: number;
  isLocked: boolean;
  lastNoiseType: 'loud_sound' | 'voice_detected' | null;
  currentVolume: number;
  dismiss: () => void;
  showWarning: boolean;
}

interface UseNoiseDetectionOptions {
  sessionId: string;
  examId: string;
  studentId: string;
  enabled?: boolean;
  // Volume threshold 0-100 — anything above this triggers a warning
  volumeThreshold?: number;
  // How many seconds to wait before another warning can fire
  cooldownSeconds?: number;
  // Called when exam should be locked after max warnings
  onLock?: () => void;
}

const MAX_WARNINGS = 5;
// Human voice sits in 85–3400 Hz — we check energy in this band
const VOICE_FREQ_MIN = 85;
const VOICE_FREQ_MAX = 3400;

export function useNoiseDetection({
  sessionId,
  examId,
  studentId,
  enabled = true,
  volumeThreshold = 40,
  cooldownSeconds = 4,
  onLock,
}: UseNoiseDetectionOptions): NoiseDetectionState {
  const [isListening, setIsListening] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [lastNoiseType, setLastNoiseType] =
    useState<'loud_sound' | 'voice_detected' | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const cooldownRef = useRef(false);
  const warningCountRef = useRef(0); // mirror of state for use inside rAF
  const isLockedRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { warningCountRef.current = warningCount; }, [warningCount]);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  // Log behavior to Supabase via /api/flag-event
  const logNoiseBehavior = useCallback(
    async (
      noiseType: 'loud_sound' | 'voice_detected',
      volume: number,
      warningNumber: number
    ) => {
      try {
        await fetch('/api/flag-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            exam_id: examId,
            student_id: studentId,
            event_type: noiseType,
            log_type: 'behavior_log', // behavior_log only, no flag
            confidence: Math.min(volume / 100, 1),
            metadata: {
              volume_level: Math.round(volume),
              warning_number: warningNumber,
              threshold_used: volumeThreshold,
              noise_type: noiseType,
            },
          }),
        });
      } catch (err) {
        console.error('[NoiseDetection] Failed to log behavior:', err);
      }
    },
    [sessionId, examId, studentId, volumeThreshold]
  );

  // Notify teacher by logging a high-severity behavior entry on lock
  const notifyTeacherLocked = useCallback(async () => {
    try {
      await fetch('/api/flag-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          exam_id: examId,
          student_id: studentId,
          event_type: 'noise_exam_locked',
          log_type: 'behavior_log',
          confidence: 1,
          metadata: {
            reason: 'Exam locked after 5 noise warnings',
            total_warnings: MAX_WARNINGS,
          },
        }),
      });
    } catch (err) {
      console.error('[NoiseDetection] Failed to notify teacher:', err);
    }
  }, [sessionId, examId, studentId]);

  // Calculate RMS volume from time-domain data (0–100 scale)
  const getRMSVolume = (dataArray: Uint8Array): number => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length) * 100;
  };

  // Check if frequency data has energy in voice range
  const hasVoiceFrequency = (
    freqData: Uint8Array,
    sampleRate: number
  ): boolean => {
    const binCount = freqData.length;
    const nyquist = sampleRate / 2;
    const minBin = Math.floor((VOICE_FREQ_MIN / nyquist) * binCount);
    const maxBin = Math.ceil((VOICE_FREQ_MAX / nyquist) * binCount);

    let voiceEnergy = 0;
    let totalEnergy = 0;

    for (let i = 0; i < binCount; i++) {
      totalEnergy += freqData[i];
      if (i >= minBin && i <= maxBin) {
        voiceEnergy += freqData[i];
      }
    }

    // Voice is present if voice-band energy > 60% of total energy
    // and overall signal is above noise floor
    const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
    return voiceRatio > 0.6 && totalEnergy > binCount * 10;
  };

  // Main analysis loop
  const analyze = useCallback(() => {
    if (!analyserRef.current || isLockedRef.current) return;

    const analyser = analyserRef.current;
    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    const volume = getRMSVolume(timeData);
    setCurrentVolume(Math.round(volume));

    const isLoud = volume >= volumeThreshold;
    const isVoice =
      isLoud &&
      hasVoiceFrequency(freqData, audioContextRef.current?.sampleRate ?? 44100);

    if (isLoud && !cooldownRef.current) {
      const noiseType: 'loud_sound' | 'voice_detected' = isVoice
        ? 'voice_detected'
        : 'loud_sound';

      const newCount = warningCountRef.current + 1;

      // Start cooldown
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, cooldownSeconds * 1000);

      setLastNoiseType(noiseType);
      setWarningCount(newCount);
      setShowWarning(true);

      logNoiseBehavior(noiseType, volume, newCount);

      if (newCount >= MAX_WARNINGS) {
        setIsLocked(true);
        isLockedRef.current = true;
        notifyTeacherLocked();
        onLock?.();
        // Stop the loop
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(analyze);
  }, [volumeThreshold, cooldownSeconds, logNoiseBehavior, notifyTeacherLocked, onLock]);

  // Start mic + analysis
  const startListening = useCallback(async () => {
    if (!enabled || isLockedRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Keep raw audio for analysis
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;

      source.connect(analyser);
      // NOT connecting to ctx.destination — silent monitoring only
      analyserRef.current = analyser;

      setIsListening(true);
      animFrameRef.current = requestAnimationFrame(analyze);
    } catch (err) {
      console.warn('[NoiseDetection] Microphone access denied or unavailable:', err);
      setIsListening(false);
    }
  }, [enabled, analyze]);

  // Stop and clean up
  const stopListening = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
  }, []);

  // Dismiss warning overlay
  const dismiss = useCallback(() => {
    setShowWarning(false);
  }, []);

  // Start on mount, stop on unmount
  useEffect(() => {
    if (enabled) startListening();
    return () => stopListening();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isListening,
    warningCount,
    isLocked,
    lastNoiseType,
    currentVolume,
    showWarning,
    dismiss,
  };
}