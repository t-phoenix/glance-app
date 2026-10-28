export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export interface AppError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  cause?: unknown;
}

export type ErrorCode =
  | 'N1'
  | 'N2'
  | 'N3'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'C1'
  | 'C2'
  | 'C3'
  | 'C4'
  | 'C5'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'I1'
  | 'I2'
  | 'W1'
  | 'W2'
  | 'W3'
  | 'W4'
  | 'W5'
  | 'W6'
  | 'W7'
  | 'W8'
  | 'B1'
  | 'B2'
  | 'S1'
  | 'X0';

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(code: ErrorCode, message: string, retryable: boolean, cause?: unknown): Result<never> {
  return { ok: false, error: { code, message, retryable, cause } };
}

export const ERROR_COPY: Record<ErrorCode, { message: string; retryable: boolean }> = {
  N1: { message: 'Offline. Scans and notes still save.', retryable: true },
  N2: { message: 'Venue Wi-Fi needs a login.', retryable: true },
  N3: { message: 'Slow connection. Paid lookups paused.', retryable: true },
  P1: { message: "That source didn't answer. Trying another.", retryable: true },
  P2: { message: 'That source is busy. Retrying in 30 s.', retryable: true },
  P3: { message: 'An API key was rejected. Check Settings, then Keys.', retryable: false },
  P4: { message: "That account wasn't found.", retryable: false },
  P5: { message: "Couldn't look this person up. Fill in by hand or retry later.", retryable: true },
  A1: { message: "Couldn't hear anything in that note.", retryable: false },
  A2: { message: 'Summary needs a look.', retryable: true },
  A3: { message: 'AI is unreachable. Note saved; summary will run later.', retryable: true },
  A4: { message: "Couldn't read that badge.", retryable: false },
  C1: { message: 'Glance needs the camera to scan QR codes.', retryable: false },
  C2: { message: 'Glance needs the microphone for voice notes.', retryable: false },
  C3: { message: 'No location. Events are matched by time only.', retryable: false },
  C4: { message: 'Phone storage is low. Notes are being saved smaller.', retryable: false },
  C5: { message: 'Recording saved (stopped by a call).', retryable: false },
  Q1: { message: "This QR is a payment or wallet link. Glance won't open it.", retryable: false },
  Q2: { message: 'Already scanned.', retryable: false },
  Q3: { message: 'You already have this person.', retryable: false },
  I1: { message: 'This account is linked to someone else.', retryable: false },
  I2: { message: 'What you typed does not match the public profile.', retryable: false },
  W1: { message: 'Wallet balance is too low for this lookup.', retryable: false },
  W2: { message: "Today's spend limit is reached.", retryable: false },
  W3: { message: 'Set up the wallet to use paid lookups.', retryable: false },
  W4: { message: 'The service asked for more than its listed price. Skipped.', retryable: false },
  W5: { message: "Payment didn't go through. Trying another source.", retryable: true },
  W6: { message: 'Paid, but the service failed. Receipt saved.', retryable: false },
  W7: { message: "Couldn't refresh balance. Showing last known.", retryable: true },
  W8: { message: 'Wallet key not found. Import or create a new one.', retryable: false },
  B1: { message: "Last night's backup didn't finish. Export manually?", retryable: true },
  B2: { message: "Backup file couldn't be opened.", retryable: false },
  S1: { message: 'Unlock with your passcode.', retryable: false },
  X0: { message: 'Something went wrong. Your data is safe.', retryable: false },
};

export function appError(code: ErrorCode, override?: string, cause?: unknown): AppError {
  const copy = ERROR_COPY[code];
  return { code, message: override ?? copy.message, retryable: copy.retryable, cause };
}
