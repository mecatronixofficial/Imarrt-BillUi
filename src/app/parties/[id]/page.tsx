import { PartyWorkspace } from "../PartyWorkspace";

export default function PartyDetailPage({ params }: { params: { id: string } }) {
  return <PartyWorkspace partyId={params.id} />;
}
