import { api } from './api';
import { PASSCODE_NOT_CONFIGURED, requestActionPasscode } from './actionPasscode';

/**
 * Party edits and deletions always ask for the Settings passcode up front,
 * instead of waiting for the server to challenge the request. When no
 * passcode has been set yet, the prompt asks the user to create one first
 * and the action does not proceed.
 */
export async function askPartyPasscode(action: 'edit-party' | 'delete-party'): Promise<string | null> {
  let enabled = true;
  try {
    enabled = (await api.get<{ enabled: boolean }>('/action-security')).data.enabled;
  } catch {
    // If the status can't be read, still ask; the server verifies the passcode.
  }
  return requestActionPasscode(enabled ? 'PASSCODE_REQUIRED' : PASSCODE_NOT_CONFIGURED, action);
}

export function passcodeHeaders(passcode: string | null | undefined) {
  return passcode ? { headers: { 'X-Action-Passcode': passcode } } : undefined;
}

export async function askDocumentPasscode(action: 'edit' | 'delete'): Promise<string | null> {
  let enabled = true;
  try {
    enabled = (await api.get<{ enabled: boolean }>('/action-security')).data.enabled;
  } catch {
    // fall through
  }
  return requestActionPasscode(enabled ? 'PASSCODE_REQUIRED' : PASSCODE_NOT_CONFIGURED, action);
}
