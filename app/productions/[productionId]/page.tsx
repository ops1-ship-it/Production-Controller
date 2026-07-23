import RecipeCostApp from "../../page";

export default function ProductionDetailPage({
  params,
}: {
  params: { productionId: string };
}) {
  return <RecipeCostApp initialPath={`/productions/${params.productionId}`} />;
}
