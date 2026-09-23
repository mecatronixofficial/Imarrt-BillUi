import { PartyWorkspace } from "../PartyWorkspace";

export default async function PartyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartyWorkspace partyId={id} />;
}
