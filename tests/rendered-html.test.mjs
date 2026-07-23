import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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

test("server-renders the recipe costing application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Recipe Cost Calculator<\/title>/i);
  assert.match(html, /Recipe Formula \/ Production \/ Costing/);
  assert.match(html, /Production scaler/);
  assert.match(html, /Live costing/);
  assert.match(html, /Formula builder/);
  assert.match(html, /Production batch/);
  assert.match(html, /Ingredient library/);
  assert.match(html, /Gross Margin/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/i);
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
  assert.match(page, /Production scaler/);
  assert.match(page, /Markup/);
  assert.match(page, /Gross Margin/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /og\.png/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.mobile-records/);
  assert.doesNotMatch(page + layout + css, /codex-preview|_sites-preview/);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot)),
  );
  await assert.rejects(
    access(new URL("app/_sites-preview/preview.css", templateRoot)),
  );
});
