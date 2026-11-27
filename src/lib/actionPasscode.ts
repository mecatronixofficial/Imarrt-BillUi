// The Settings passcode protects edits (PUT/PATCH) and deletions (DELETE) only.
export type PasscodeAction = 'edit' | 'delete' | 'edit-party' | 'delete-party';
export const PASSCODE_NOT_CONFIGURED = 'PASSCODE_NOT_CONFIGURED';
type Challenge = { message: string; action: PasscodeAction; resolve: (passcode: string | null) => void };
let handler: ((challenge: Challenge) => void) | null = null;

export function registerPasscodeHandler(next: (challenge: Challenge) => void) {
  handler = next;
  return () => { if (handler === next) handler = null; };
}

export function requestActionPasscode(message: string, action: PasscodeAction = 'edit'): Promise<string | null> {
  if (!handler) return Promise.resolve(null);
  return new Promise((resolve) => handler?.({ message, action, resolve }));
}

export function isPasscodeChallenge(status: number | undefined, message: unknown) {
  return status === 403 && (message === 'PASSCODE_REQUIRED' || message === 'PASSCODE_INVALID');
}

export function passcodeAction(method?: string, url = ''): PasscodeAction {
  const path = url.split('?')[0];
  const deleting = method?.toLowerCase() === 'delete';
  const party = /^\/parties\/[^/]+\/?$/.test(path) || /^\/party-groups\/[^/]+\/parties\/?$/.test(path);
  if (party) return deleting ? 'delete-party' : 'edit-party';
  return deleting ? 'delete' : 'edit';
}
