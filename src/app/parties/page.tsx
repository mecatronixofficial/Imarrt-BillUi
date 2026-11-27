import { redirect } from 'next/navigation';
import PartiesDashboard from './PartiesDashboard';

type Query = { create?: string | string[]; group?: string | string[] };

export default async function PartiesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const create = Array.isArray(query.create) ? query.create[0] : query.create;
  const group = Array.isArray(query.group) ? query.group[0] : query.group;
  if (create || group) {
    const target = new URLSearchParams();
    if (create) target.set('create', create);
    if (group) target.set('group', group);
    redirect('/parties/details?' + target.toString());
  }
  return <PartiesDashboard />;
}