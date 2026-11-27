import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeSet, isCodeTaken } from '../src/lib/codes';

const records = [{ id: 'a', code: 'P-0001' }, { id: 'b', code: ' Ret ' }, { id: 'c', code: null }, { id: 'd' }];

test('a code already used by another record is reported, ignoring case and spaces', () => {
  const taken = codeSet(records);
  assert.equal(isCodeTaken('p-0001', taken), true);
  assert.equal(isCodeTaken('  RET', taken), true);
  assert.equal(isCodeTaken('P-0002', taken), false);
});
test('blank codes are never reported as taken, since the server generates one', () => {
  assert.equal(isCodeTaken('   ', codeSet(records)), false);
});
test('the record being edited may keep its own code', () => {
  assert.equal(isCodeTaken('P-0001', codeSet(records, 'a')), false);
  assert.equal(isCodeTaken('P-0001', codeSet(records, 'b')), true);
});
