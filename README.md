# Recipe Cost Calculator

Production Controller application for recipe formulas, ingredient costing,
production batches, completed-yield calculations, reports, and operational
settings.

Repository: `ops1-ship-it/Production-Controller`

## Prerequisites

- Node.js `>=22.13.0`
- npm

## Local Development

```bash
npm install
npm run dev
```

Useful commands:

- `npm run build`: compile the vinext application.
- `npm test`: build and run server-rendered route checks.
- `npm run lint`: run ESLint.
- `npm run db:generate`: generate Drizzle migrations after schema changes.

## Application Routes

- `/dashboard`: operational summary.
- `/ingredients`: Ingredients Bible with search, filters, inline costing, duplicate, and archive actions.
- `/recipes`: saved recipe library with view, edit, duplicate, production, archive, and delete actions.
- `/recipes/new`: create a recipe.
- `/recipes/[recipeId]`: read-only recipe detail.
- `/recipes/[recipeId]/edit`: edit the base formula, method, yield, and cost rules.
- `/productions`: production landing page.
- `/productions/new`: start a production from a saved recipe snapshot.
- `/productions/in-progress`: manage active batches.
- `/productions/completed`: read-only completed production history.
- `/productions/[productionId]`: production detail and completion workflow.
- `/reports`: yield, cost, and profitability summaries.
- `/settings`: lookup values and costing policy notes.

## Source Control Policy

- Use feature branches for all new work.
- Never commit directly to `main`.
- Keep commits focused and atomic.
- Use descriptive commit messages.
- Compile and test successfully before committing.
- Keep documentation updated with behavior, workflow, or setup changes.
- Preserve the project structure under `app/`, `tests/`, `db/`, and `.github/`.

Recommended branch naming:

```bash
git switch -c feature/short-description
```

Codex-authored branches use the `codex/` prefix.

## Secrets and Configuration

- Do not commit secrets, API keys, access tokens, PEM files, `.npmrc`, or local environment files.
- Store sensitive configuration in environment variables managed by the deployment platform.
- Use `.env.example` for non-sensitive sample variable names only.
- Build artifacts, dependencies, local Wrangler output, caches, and environment files are ignored in `.gitignore`.

No runtime environment variables are required for the current app surface.

## Continuous Integration

GitHub Actions runs on pull requests to `main` and pushes to `main`:

1. Install dependencies with `npm ci`.
2. Run `npm run lint`.
3. Run `npm test`, which builds the app and checks the rendered application routes.

The workflow lives at `.github/workflows/ci.yml`.

## Deployment

The app is configured for OpenAI Sites through `.openai/hosting.json`.
Deployment artifacts are generated from the validated build output and should
only be published from committed source.
