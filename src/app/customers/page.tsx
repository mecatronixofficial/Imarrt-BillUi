import { redirect } from 'next/navigation';

export default function LegacyPartiesRedirect() {
  redirect('/parties');
}
