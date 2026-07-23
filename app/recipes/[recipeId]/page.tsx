import RecipeCostApp from "../../page";

export default function RecipeDetailPage({
  params,
}: {
  params: { recipeId: string };
}) {
  return <RecipeCostApp initialPath={`/recipes/${params.recipeId}`} />;
}
