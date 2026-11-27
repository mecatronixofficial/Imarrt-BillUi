import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPasscodeChallenge, passcodeAction, registerPasscodeHandler, requestActionPasscode } from '../src/lib/actionPasscode';

test('passcode requests fail closed when the authenticated prompt is unavailable', async () => {
  assert.equal(await requestActionPasscode('PASSCODE_REQUIRED'), null);
});
test('only server passcode challenges open the passcode flow', () => {
  assert.equal(isPasscodeChallenge(403, 'PASSCODE_REQUIRED'), true);
  assert.equal(isPasscodeChallenge(403, 'PASSCODE_INVALID'), true);
  assert.equal(isPasscodeChallenge(401, 'PASSCODE_REQUIRED'), false);
  assert.equal(isPasscodeChallenge(403, 'You do not have access'), false);
});
test('each mutation needs its own prompt and cancellation does not approve another request', async () => {
  const challenges: Array<{ resolve: (value: string | null) => void }> = [];
  const unregister = registerPasscodeHandler((challenge) => challenges.push(challenge));
  try {
    const first = requestActionPasscode('PASSCODE_REQUIRED');
    const second = requestActionPasscode('PASSCODE_REQUIRED');
    assert.equal(challenges.length, 2);
    challenges[0].resolve(null); challenges[1].resolve('123456');
    assert.equal(await first, null); assert.equal(await second, '123456');
  } finally { unregister(); }
  assert.equal(await requestActionPasscode('PASSCODE_REQUIRED'), null);
});
test('party changes show the appropriate password confirmation action', () => {
  assert.equal(passcodeAction('DELETE', '/parties/a'), 'delete-party');
  assert.equal(passcodeAction('patch', '/parties/a?branch=b'), 'edit-party');
  assert.equal(passcodeAction('PUT', '/party-groups/group/parties'), 'edit-party');
  assert.equal(passcodeAction('DELETE', '/items/a'), 'delete');
  assert.equal(passcodeAction('DELETE', '/party-groups/g'), 'delete');
  assert.equal(passcodeAction('PATCH', '/items/a'), 'edit');
  assert.equal(passcodeAction('PUT', '/settings'), 'edit');
});
test('passcode prompt receives party deletion context for its verification button', async () => {
  const unregister = registerPasscodeHandler((challenge) => {
    assert.equal(challenge.action, 'delete-party');
    challenge.resolve(null);
  });
  try { assert.equal(await requestActionPasscode('PASSCODE_REQUIRED', 'delete-party'), null); }
  finally { unregister(); }
});