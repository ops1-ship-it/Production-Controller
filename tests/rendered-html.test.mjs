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

test("server-renders the public home and authentication entry point", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Production Controller<\/title>/i);
  assert.match(html, /Production Controller/);
  assert.match(html, /Login/);
  assert.match(html, /Register/);
  assert.match(html, /Email address/);
  assert.match(html, /Password/);
  assert.doesNotMatch(html, /mobile-bottom-nav/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/i);
});

test("redirects unauthenticated protected routes to the public home page", async () => {
  const [ingredientsResponse, recipesResponse, productionResponse] =
    await Promise.all([
      render("/ingredients"),
      render("/recipes"),
      render("/productions/new"),
    ]);

  assert.equal(ingredientsResponse.status, 307);
  assert.equal(recipesResponse.status, 307);
  assert.equal(productionResponse.status, 307);
  assert.match(ingredientsResponse.headers.get("location") ?? "", /\/\?next=%2Fingredients/);
  assert.match(recipesResponse.headers.get("location") ?? "", /\/\?next=%2Frecipes/);
  assert.match(
    productionResponse.headers.get("location") ?? "",
    /\/\?next=%2Fproductions%2Fnew/,
  );
});

test("keeps starter preview code removed and includes Supabase setup", async () => {
  const [
    page,
    layout,
    css,
    packageJson,
    envExample,
    migration,
    registrationMigration,
    middleware,
    countryConfig,
    supabaseReadme,
  ] =
    await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/202607230001_initial_production_controller.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202607230003_home_auth_registration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/lib/supabase/middleware.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/business/countries.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/README.md", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"name": "recipe-cost-calculator"/);
  assert.match(packageJson, /"@supabase\/supabase-js"/);
  assert.match(packageJson, /"@supabase\/ssr"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(page, /function convertQuantity/);
  assert.match(page, /createSupabaseBrowserClient/);
  assert.match(page, /signInWithPassword/);
  assert.match(page, /resetPasswordForEmail/);
  assert.match(page, /registration_intent/);
  assert.match(page, /const deleteRecipe/);
  assert.match(page, /Ingredients List/);
  assert.match(page, /Export Current Ingredient List as XLSX/);
  assert.match(page, /Download CSV Import Template/);
  assert.match(page, /Calculated production ingredients/);
  assert.match(page, /Markup/);
  assert.match(page, /Gross Margin/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /Production Controller/);
  assert.match(layout, /og\.png/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 188px/);
  assert.match(css, /\.public-home-shell/);
  assert.match(css, /\.auth-panel/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.ingredient-list-sheet/);
  assert.match(css, /\.import-preview-sheet/);
  assert.match(css, /\.recipes-list-sheet/);
  assert.match(css, /\.mobile-records/);
  assert.match(css, /\.mobile-bottom-nav/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /start_production_batch/);
  assert.match(migration, /complete_production_batch/);
  assert.match(migration, /storage\.buckets/);
  assert.match(registrationMigration, /handle_new_user_registration/);
  assert.match(registrationMigration, /business_users_set_updated_at/);
  assert.match(registrationMigration, /registration_idempotency_key/);
  assert.match(middleware, /protectedRoutePrefixes/);
  assert.match(middleware, /NextResponse\.redirect/);
  assert.match(countryConfig, /defaultCurrencyCode: "ZAR"/);
  assert.match(countryConfig, /defaultCurrencyCode: "USD"/);
  assert.match(supabaseReadme, /Row Level Security/);
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
    access(new URL("proxy.ts", templateRoot)),
    access(new URL("src/lib/supabase/client.ts", templateRoot)),
    access(new URL("src/lib/supabase/server.ts", templateRoot)),
    access(new URL("src/lib/supabase/database.types.ts", templateRoot)),
    access(new URL("src/lib/supabase/storage.ts", templateRoot)),
    access(new URL("src/lib/supabase/realtime.ts", templateRoot)),
    access(new URL("src/lib/business/countries.ts", templateRoot)),
    access(new URL("supabase/migrations/202607230003_home_auth_registration.sql", templateRoot)),
    access(new URL("supabase/test-checklist.md", templateRoot)),
  ]);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot)),
  );
  await assert.rejects(
    access(new URL("app/_sites-preview/preview.css", templateRoot)),
  );
});
