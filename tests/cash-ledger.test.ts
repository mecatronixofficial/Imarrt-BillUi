import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareCashTransactions } from '../src/lib/cash-ledger';

test('same-day cash entries put the latest recorded entry first regardless of UUID', () => {
  const entries = [
    { id: 'z-old', date: '2026-11-03', createdAt: '2026-11-03T04:30:00.000Z' },
    { id: 'a-new', date: '2026-11-03', createdAt: '2026-11-03T10:30:00.000Z' },
  ];
  assert.deepEqual([...entries].sort(compareCashTransactions).map((entry) => entry.id), ['a-new', 'z-old']);
  assert.deepEqual([...entries].sort((a, b) => compareCashTransactions(a, b, false)).map((entry) => entry.id), ['z-old', 'a-new']);
});

test('cash entries keep transaction dates in order when an older payment is backdated', () => {
  const current = { id: 'current', date: '2026-11-03', createdAt: '2026-11-03T05:00:00.000Z' };
  const backdated = { id: 'backdated', entryDate: '2026-11-01', createdAt: '2026-11-03T10:00:00.000Z' };
  assert.ok(compareCashTransactions(current, backdated) < 0);
});

test('legacy responses without createdAt still have a stable order', () => {
  const a = { id: 'a', date: '2026-11-03' };
  const b = { id: 'b', date: '2026-11-03' };
  assert.ok(compareCashTransactions(a, b) > 0);
});
