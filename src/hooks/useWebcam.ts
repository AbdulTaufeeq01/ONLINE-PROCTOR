'use client';

import { useEffect, useState } from 'react';

interface UseWebcamReturn {
  stream: MediaStream | null;
  error: string | null;
  isPermissionDenied: boolean;
  requestAccess: () => Promise<void>;
  stopStream: () => void;
}

/**
 * Webcam access hook
 * @returns { stream, error, isPermissionDenied, requestAccess, stopStream }
 */
export function useWebcam(): UseWebcamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);

  const requestAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      setStream(mediaStream);
      setError(null);
      setIsPermissionDenied(false);
    } catch (err) {
      const error = err as Error & { name: string };

      if (error.name === 'NotAllowedError') {
        setIsPermissionDenied(true);
        setError('Camera permission denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Unable to access camera.');
      }

      setStream(null);
    }
  };

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  return {
    stream,
    error,
    isPermissionDenied,
    requestAccess,
    stopStream,
  };
}