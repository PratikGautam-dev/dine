# erp-dine-backend: migrations are the only schema

Done on 2026-11-27, on the `chandan` branch of erp-dine-backend.

## What changed and why

**Before.** The schema lived in two places:
- the Alembic migrations, used for Neon and Render;
- an idempotent "replay" in `db/init_db.py`: about 1,600 lines of DDL plus 25 `db/*_schema.py` modules. Tests and fresh databases were built from it.

Every change had to be written twice. The two copies drifted apart, which caused the 0071 outage and the repair code in `init_db.py`.

**Now.** The migrations are the only source of the schema. Every database is built by `alembic upgrade head`: tests, a fresh clone, staging and Render. `db/init_db.py` only migrates and then seeds data (`seed_and_backfill`).

This is the industry pattern (Rails, Django, Flyway):
1. Write each change once, as a migration.
2. Build every environment the same way.
3. Generate a readable schema file; never write it by hand.

## How to change the schema now

1. Add `db/migrations/versions/00NN_description.py`. Keep its SQL in the file, write it idempotently (`IF NOT EXISTS` / `IF EXISTS`), and give it a `downgrade()`.
2. Run `uv run python scripts/dump_schema.py`. It runs every migration in a throwaway Docker Postgres and rewrites `db/schema.sql`.
3. Commit both files. `scripts/check_schema.sh` fails if `db/schema.sql` doesn't match the migrations. Run it before pushing; it moves into CI later.
4. Locally, apply it with `uv run python -m db.init_db`. Production is migrated by the pipeline (below) when the change is merged to `main`.

Never edit a merged migration. Migrations only add: tables, nullable columns, functions. A rename or drop takes two releases, because production migrates before it deploys and the old code briefly runs on the new schema. `db/schema.sql` is for reading only: nothing executes it.

## How production is migrated: the GitHub Actions pipeline

`.github/workflows/deploy.yml` in erp-dine-backend. The same pipeline works on any host: moving off Render changes only the last step.

```
checks   (every PR and push)    check_schema.sh + the POS tests
   ↓ only if green, and only on a push to main (a merge)
migrate                          python -m db.init_db  → production database (Neon today)
   ↓ only if it succeeded
deploy                           Render deploy hook for that commit  (later: ssh + docker on our server)
```

- **Failures stop the pipeline.** Failing checks never touch the database. A failed migration never deploys, and the old code keeps running. Each migration runs in a transaction, so a failed one leaves nothing half-done. Fix forward with a new commit.
- **The container no longer migrates.** The Dockerfile only starts uvicorn. The startup check refuses a database that is *behind* the code, but accepts one that is *ahead*: during a deploy, and after a rollback, older code meets a newer schema.
- **Secrets:** two secrets of the GitHub environment `production`, readable only by the `migrate` and `deploy` jobs:
  - `DATABASE_URL`: the same connection string the server uses.
  - `RENDER_DEPLOY_HOOK`: from Render, Settings, then Deploy Hook.
- **Render settings:** auto-deploy **Off**, pre-deploy command empty. The pipeline is the only thing that migrates or deploys.
- **Test gate:** the POS tests for now, because the rest of the suite already fails on `main`. Widen it as those tests are fixed.

**At the first merge of `chandan`:** `main` stops at 0121, so the pipeline will apply **0122 to 0130** to Neon: POS menu, bills, shifts, LAN, business day, hand-over, workforce view, table flow and the trigger fix. All of them only add.

## How the switch was proven safe

**Schema and data compared.** One database was built the old way (replay) and one the new way (migrations, then the seed). Their `pg_dump` schemas and all data rows were compared.
- The data matched in every table; only randomly generated ids differed.
- **One real bug was found.** In the migrations, the trigger function `set_default_branch_id()` still used `NEW.hospital_id`, so on a database built only by migrations, inserting an order or a roster entry without a branch failed. Migration **0130** fixes it. Every existing database already had the replay's fixed version, so there 0130 changes nothing.
- **What was left alone (cosmetic):**
  - constraint names still saying "hospital" or auto-named
  - `DEFAULT 0` written as `'0'::bigint`
  - column order in `food_orders`
  - `platform_settings.id` having a sequence
  - two extra foreign keys in the migration build

**Existing databases.** A throwaway database at 0129 ran the new `init_db()`. It moved to 0130 and got the fixed trigger, and a second run changed nothing.

**Tests.**
- Old and new give the same failing tests: the suite already had about 160 failures, and none are new.
- The RBAC, staff and leave failures that appear in some runs depend on test order. They fail the same way on the old code when run file by file.
- One cause of that was found: the tests used the developer's local Redis (from `.env`), which all parallel test workers shared. A permission cached by one worker leaked into another. `tests/conftest.py` now turns Redis off for tests.

## What was removed
- `init_db_on_connection()` and the replayed DDL.
- The one-time hospital→restaurant and patient→customer renames (every database had already run them) and the frozen-baseline rewriting.
- The 25 `db/*_schema.py` modules. The 27 migrations that imported SQL from them now hold that SQL themselves, as the exact same text; each was checked equal after the rewrite. `0105` also holds the pincode loader.
- The hand-written `db/schema.sql`, replaced by the generated one.

## Later
- **Squash:** when the migrations number in the hundreds, add a new baseline built from `db/schema.sql` for fresh databases. Databases already past it skip it.
- **Test gate:** widen it from the POS tests to the whole suite as the existing failures are fixed.
- **Own server:** replace the `deploy` job with ssh + docker. `DATABASE_URL` can then leave GitHub, with the migration run on the server over ssh.
- **ShopConnect:** generate `erp_schema.sql` in the same way instead of editing it by hand.
