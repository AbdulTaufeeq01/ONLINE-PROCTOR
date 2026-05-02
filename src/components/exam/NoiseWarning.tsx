'use client';

interface NoiseWarningProps {
  warningCount: number;
  maxWarnings?: number;
  noiseType: 'loud_sound' | 'voice_detected' | null;
  onDismiss: () => void;
}

const NOISE_LABELS: Record<string, string> = {
  loud_sound: 'Loud background sound detected',
  voice_detected: 'Voice / speech detected nearby',
};

const NOISE_TIPS: Record<string, string> = {
  loud_sound: 'Please move to a quieter location or reduce background noise.',
  voice_detected:
    'Please ensure no one is speaking nearby. Verbal communication during exams is not allowed.',
};

export default function NoiseWarning({
  warningCount,
  maxWarnings = 5,
  noiseType,
  onDismiss,
}: NoiseWarningProps) {
  const remaining = maxWarnings - warningCount;
  const isLastWarning = remaining === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Top bar */}
        <div
          className={`px-6 py-4 ${
            isLastWarning ? 'bg-red-600' : 'bg-orange-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎤</span>
            <div>
              <h2 className="text-white font-bold text-lg">
                {isLastWarning ? 'Exam Locked' : 'Noise Detected'}
              </h2>
              <p className="text-white/80 text-sm">
                Warning {warningCount} of {maxWarnings}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Warning progress dots */}
          <div className="flex gap-2 mb-5">
            {Array.from({ length: maxWarnings }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  i < warningCount
                    ? isLastWarning
                      ? 'bg-red-500'
                      : 'bg-orange-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Noise type */}
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="font-semibold text-orange-800 mb-1">
              {noiseType ? NOISE_LABELS[noiseType] : 'Background noise detected'}
            </p>
            <p className="text-sm text-orange-700">
              {noiseType ? NOISE_TIPS[noiseType] : 'Please ensure your environment is quiet.'}
            </p>
          </div>

          {/* Remaining warnings or locked message */}
          {isLastWarning ? (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-semibold text-red-800 mb-1">
                Your exam has been locked
              </p>
              <p className="text-sm text-red-700">
                You have received {maxWarnings} noise warnings. Your exam is now
                locked and your teacher has been notified. You may no longer
                submit answers.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-semibold text-gray-900">
                {remaining} warning{remaining !== 1 ? 's' : ''} remaining
              </span>{' '}
              before your exam is locked. Please silence your environment.
            </p>
          )}

          {/* Action button */}
          {!isLastWarning && (
            <button
              onClick={onDismiss}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              I Understand — Continue Exam
            </button>
          )}

          {isLastWarning && (
            <div className="text-center text-sm text-gray-500">
              Contact your teacher or invigilator for assistance.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}