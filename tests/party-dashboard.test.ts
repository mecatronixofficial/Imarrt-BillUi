import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPartyOverview } from '../src/lib/party-dashboard';
import type { Party } from '../src/types';

const party = (id: string, balanceDue: number, extra: Partial<Party> = {}) => ({ id, name: id, balanceDue, ...extra }) as Party;

test('party dashboard keeps receivables and payables separate and adds decimals exactly', () => {
  const overview = buildPartyOverview([party('a', 0.1), party('b', 0.2), party('c', -10.25), party('d', 0), party('e', NaN)], []);
  assert.equal(overview.receivable, 0.3);
  assert.equal(overview.payable, 10.25);
  assert.deepEqual(overview.outstanding.map((party) => party.id), ['b', 'a']);
});
test('party dashboard keeps empty groups, resolves legacy names, and counts ungrouped parties', () => {
  const overview = buildPartyOverview([party('a', 0, { groupId: 'wholesale', group: 'Old name' }), party('b', 0, { group: 'Wholesale' }), party('c', 0)], [{ id: 'wholesale', name: 'Wholesale' }, { id: 'empty', name: 'Retail' }]);
  assert.equal(overview.partyCount, 3);
  assert.equal(overview.groupCount, 2);
  assert.equal(overview.ungroupedCount, 1);
  assert.deepEqual(overview.groups.map((group) => [group.id, group.count]), [['wholesale', 2], ['empty', 0]]);
});
test('party dashboard shows the five highest receivables without changing input order', () => {
  const parties = Array.from({ length: 7 }, (_, i) => party(String(i), i + 1));
  assert.deepEqual(buildPartyOverview(parties, []).outstanding.map((party) => party.balanceDue), [7, 6, 5, 4, 3]);
  assert.equal(parties[0].balanceDue, 1);
});
test('empty party dashboard has zero totals and empty lists', () => {
  const overview = buildPartyOverview([], []);
  assert.equal(overview.receivable, 0);
  assert.equal(overview.payable, 0);
  assert.equal(overview.partyCount, 0);
  assert.equal(overview.groupCount, 0);
  assert.equal(overview.ungroupedCount, 0);
  assert.deepEqual(overview.groups, []);
  assert.deepEqual(overview.outstanding, []);
});
