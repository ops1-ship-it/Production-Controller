import RecipeCostApp from "../../../page";

export default function RecipeEditPage({
  params,
}: {
  params: { recipeId: string };
}) {
  return <RecipeCostApp initialPath={`/recipes/${params.recipeId}/edit`} />;
}
