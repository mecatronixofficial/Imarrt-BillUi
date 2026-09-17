import { ProductionWorkspace } from '../ProductionWorkspace';

export default function ProductionOrderPage({ params }: { params: { id: string } }) {
  return <ProductionWorkspace orderId={params.id} />;
}
