# Supabase Setup

This directory contains the database setup for the Recipe Cost Calculator /
Production Controller Supabase backend.

## Environment

Create a local `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://comyiwrafzylcpnfpxuu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_UxoDi9NemkYpFKMX8xW25g_GHLyGmOI
```

`.env.local` is ignored by Git. Do not commit service-role keys, database
passwords, access tokens or other secrets.

## Migrations

Apply migrations from `supabase/migrations/` in timestamp order. The initial
migration creates:

- businesses, locations, profiles and access tables
- Ingredients List, categories and suppliers
- recipes, recipe versions, formula lines and method steps
- production batches, ingredient snapshots, method snapshots, costs, notes and images
- audit logs
- standard units and production status seed records
- private storage buckets and policies
- database functions for access checks, batch numbers, start production and complete production
- indexes, constraints and Row Level Security policies

The application expects all runtime tables to be protected by RLS. Browser
queries still include explicit `business_id` and `location_id` filters for
performance and clarity.

## Authentication And Access

Users authenticate through Supabase Auth. A signed-in user must have an active
`business_users` row to load application data.

Initial roles:

- `owner`
- `administrator`
- `manager`
- `production_user`
- `viewer`

Owners and administrators should create businesses, locations and user access
records as part of operational setup. The browser app does not bootstrap owner
access on its own.

## Storage

Private buckets:

- `recipe-images`
- `recipe-method-images`
- `production-images`
- `ingredient-images`

Application uploads should:

- validate MIME type
- validate file size
- compress to WebP before upload
- store files under `business-id/...` folders
- save only the storage path in the database
- use signed URLs for display

## Generated Types

TypeScript database types live in `src/lib/supabase/database.types.ts`.
Regenerate them from the Supabase project whenever the SQL schema changes, then
commit the updated type file with the migration.
