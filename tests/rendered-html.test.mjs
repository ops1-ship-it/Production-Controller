import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(path = "/dashboard") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the routed recipe costing application", async () => {
  const response = await render("/dashboard");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Recipe Cost Calculator<\/title>/i);
  assert.match(html, />Dashboard</);
  assert.match(html, /Ingredients Bible/);
  assert.match(html, />Recipes</);
  assert.match(html, />Productions</);
  assert.match(html, />Reports</);
  assert.match(html, />Settings</);
  assert.match(html, /Current activity/);
  assert.match(html, /mobile-bottom-nav/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/i);
});

test("renders independent ingredient, recipe and production routes", async () => {
  const [ingredientsResponse, recipesResponse, productionResponse] =
    await Promise.all([
      render("/ingredients"),
      render("/recipes"),
      render("/productions/new"),
    ]);

  assert.equal(ingredientsResponse.status, 200);
  assert.equal(recipesResponse.status, 200);
  assert.equal(productionResponse.status, 200);

  const [ingredientsHtml, recipesHtml, productionHtml] = await Promise.all([
    ingredientsResponse.text(),
    recipesResponse.text(),
    productionResponse.text(),
  ]);

  assert.match(ingredientsHtml, /Search ingredient or SKU/);
  assert.match(ingredientsHtml, />\+ Ingredient</);
  assert.match(ingredientsHtml, /Duplicate/);
  assert.match(ingredientsHtml, /Archive/);

  assert.match(recipesHtml, /Traditional Silverside Biltong/);
  assert.match(recipesHtml, />View</);
  assert.match(recipesHtml, />Edit</);
  assert.match(recipesHtml, />Delete</);
  assert.match(recipesHtml, /Create Production/);

  assert.match(productionHtml, /New Production/);
  assert.match(productionHtml, /Scaling Factor/);
  assert.match(productionHtml, /Calculated production ingredients/);
  assert.match(productionHtml, /Production method snapshot/);
});

test("keeps starter preview code removed", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"name": "recipe-cost-calculator"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(page, /function convertQuantity/);
  assert.match(page, /recipe-cost-calculator:v2-application-data/);
  assert.match(page, /const deleteRecipe/);
  assert.match(page, /Ingredients Bible/);
  assert.match(page, /Calculated production ingredients/);
  assert.match(page, /Markup/);
  assert.match(page, /Gross Margin/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /og\.png/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 188px/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.ingredient-bible-sheet/);
  assert.match(css, /\.recipes-list-sheet/);
  assert.match(css, /\.mobile-records/);
  assert.match(css, /\.mobile-bottom-nav/);
  assert.doesNotMatch(page + layout + css, /codex-preview|_sites-preview/);

  await Promise.all([
    access(new URL("app/dashboard/page.tsx", templateRoot)),
    access(new URL("app/ingredients/page.tsx", templateRoot)),
    access(new URL("app/recipes/page.tsx", templateRoot)),
    access(new URL("app/recipes/new/page.tsx", templateRoot)),
    access(new URL("app/productions/page.tsx", templateRoot)),
    access(new URL("app/productions/new/page.tsx", templateRoot)),
    access(new URL("app/productions/in-progress/page.tsx", templateRoot)),
    access(new URL("app/productions/completed/page.tsx", templateRoot)),
    access(new URL("app/reports/page.tsx", templateRoot)),
    access(new URL("app/settings/page.tsx", templateRoot)),
  ]);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot)),
  );
  await assert.rejects(
    access(new URL("app/_sites-preview/preview.css", templateRoot)),
  );
});
