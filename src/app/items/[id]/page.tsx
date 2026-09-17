import { ItemWorkspace } from '../ItemWorkspace';

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  return <ItemWorkspace itemId={params.id} />;
}
