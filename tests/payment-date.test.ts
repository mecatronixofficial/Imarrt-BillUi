import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localPaymentDateTime, paymentDateToIso } from '../src/lib/payment-date';

test('payment picker defaults to the local clock, including dates near midnight', () => {
  assert.equal(localPaymentDateTime(new Date(2026, 10, 3, 0, 15)), '2026-11-03T00:15');
  assert.equal(localPaymentDateTime(new Date(2026, 10, 3, 23, 59)), '2026-11-03T23:59');
});

test('a backdated payment round trips through UTC without changing the chosen local date or time', () => {
  const value = '2026-10-30T18:45';
  const iso = paymentDateToIso(value);
  assert.match(iso, /Z$/);
  assert.equal(localPaymentDateTime(new Date(iso)), value);
});

test('invalid or incomplete payment dates cannot become a different payment date', () => {
  for (const value of ['', '2026-11-03', '2026-02-30T10:00', '2026-11-03T25:00', '2026-13-03T10:00', 'not-a-date']) {
    assert.throws(() => paymentDateToIso(value), /valid payment date and time/);
  }
});
