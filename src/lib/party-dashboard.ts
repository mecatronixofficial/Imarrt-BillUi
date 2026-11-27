import { sumMoney } from '@/lib/billing';
import type { Party, PartyGroup } from '@/types';

export function buildPartyOverview(parties: Party[], groups: PartyGroup[]) {
  const balance = (party: Party) => Number.isFinite(Number(party.balanceDue)) ? Number(party.balanceDue) : 0;
  const groupCounts = new Map<string, number>();
  const byId = new Map(groups.map((group) => [group.id, group]));
  const byName = new Map(groups.map((group) => [group.name, group]));
  for (const party of parties) {
    const group = party.groupId ? byId.get(party.groupId) : byName.get(party.group ?? '');
    if (group) groupCounts.set(group.id, (groupCounts.get(group.id) ?? 0) + 1);
  }
  return {
    partyCount: parties.length,
    groupCount: groups.length,
    ungroupedCount: parties.filter((party) => !party.groupId && !party.group?.trim()).length,
    receivable: sumMoney(parties.filter((party) => balance(party) > 0).map(balance)),
    payable: sumMoney(parties.filter((party) => balance(party) < 0).map((party) => -balance(party))),
    outstanding: parties.filter((party) => balance(party) > 0).sort((a, b) => balance(b) - balance(a)).slice(0, 5),
    groups: groups.map((group) => ({ ...group, count: groupCounts.get(group.id) ?? 0 })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}