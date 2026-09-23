import { ProductionWorkspace } from '../ProductionWorkspace';

export default async function ProductionOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductionWorkspace orderId={id} />;
}
