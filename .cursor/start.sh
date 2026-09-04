#!/usr/bin/env bash
# Per-boot startup: bring up PostgreSQL and make sure the dev database exists.
# Must be idempotent and tolerate being run on a fresh boot from a build.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VER="$(ls /etc/postgresql | sort -V | tail -1)"

echo "==> Starting PostgreSQL ${PG_VER}"
sudo pg_ctlcluster "$PG_VER" main start || true
for _ in $(seq 1 30); do pg_isready -h localhost -q && break; sleep 1; done
pg_isready -h localhost

echo "==> Ensuring role and database exist"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ubuntu'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ubuntu LOGIN SUPERUSER;"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ecclesiastical_lineage_dev'" | grep -q 1 \
  || sudo -u postgres createdb -O ubuntu ecclesiastical_lineage_dev

# If the database was recreated (e.g. lost from a snapshot), align Alembic.
if [ -f .env ]; then
  set -a; . ./.env; set +a
  export FLASK_APP=app.py
  if ! psql "$DATABASE_URL" -tAc "SELECT 1 FROM alembic_version" 2>/dev/null | grep -q 1; then
    echo "==> Alembic version missing; stamping head"
    ./env/bin/flask db stamp head || true
  fi
fi

echo "==> start.sh complete"
