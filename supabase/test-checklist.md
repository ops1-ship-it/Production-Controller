# Supabase Workflow Test Checklist

Run this checklist after applying migrations to the target Supabase project.

## Authentication

- Open `/` and confirm the public Production Controller home page shows Login and Register.
- Confirm email/password login navigates to `/dashboard` and shows a success toast.
- Confirm incorrect login details keep the user on `/` and show a failure toast.
- Confirm Forgot Password sends a reset email without revealing whether the email exists.
- Complete the two-step registration workflow and confirm the first business is created.
- Confirm the registering user receives the `owner` membership role.
- Confirm email verification displays the verification screen when Supabase requires verification.
- Confirm unauthenticated visits to `/dashboard`, `/ingredients`, `/recipes`, `/productions`, `/reports` and `/settings` redirect to `/`.
- Confirm a signed-in user without `business_users` access sees the no-business state.
- Confirm a signed-in business user can load dashboard counts.

## Ingredients List

- Create an ingredient.
- Edit name, SKU, purchase quantity, purchase cost, base UOM and wastage.
- Duplicate an ingredient.
- Archive an ingredient.
- Confirm duplicate SKU errors show a useful failure toast.

## Recipes

- Create a recipe after at least one ingredient exists.
- Edit recipe name, code, category, status, expected yield and pricing settings.
- Add, edit, mark-main and delete formula lines.
- Add, edit, reorder and delete method steps.
- Duplicate a recipe.
- Archive and delete a recipe.

## Production

- Start a production from a saved recipe.
- Confirm formula lines and method steps are copied into production snapshots.
- Update actual ingredient quantities and notes.
- Add progress notes.
- Complete a production with end date, starting yield, completed yield, quality rating and outcome notes.
- Confirm completed productions are read-only by default.

## Costing And Yield

- Confirm ingredient price edits do not change historical production snapshots.
- Confirm completion calculates actual ingredient cost, additional cost, total cost, yield percentage, loss, selling price and margin.
- Confirm reports use completed actual yield and cost values.

## Storage

- Upload supported recipe, ingredient and production images.
- Confirm unsupported MIME types are rejected.
- Confirm large files are rejected.
- Confirm saved database records store only storage paths.
- Confirm private images are displayed through signed URLs.

## Realtime

- Open an active production in two authorized sessions.
- Change production status in one session.
- Confirm the other session refreshes the active production list or detail.
- Add a production note and confirm the authorized open view updates.
