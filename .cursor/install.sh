#!/usr/bin/env bash
# One-time repository bootstrap for the Cloud Agent environment.
# Durable setup only: system packages, Python virtualenv, PostgreSQL cluster,
# dev database, and .env. Per-boot startup lives in start.sh.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing system packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  postgresql postgresql-contrib libpq-dev \
  python3-venv python3-dev build-essential

echo "==> Creating Python virtualenv and installing dependencies"
if [ ! -x env/bin/python ]; then
  python3 -m venv env
fi
./env/bin/pip install --upgrade pip
./env/bin/pip install -r requirements.txt

PG_VER="$(ls /etc/postgresql | sort -V | tail -1)"
HBA="/etc/postgresql/${PG_VER}/main/pg_hba.conf"

echo "==> Configuring PostgreSQL (${PG_VER}) for trusted local dev connections"
sudo sed -i -E \
  's|^(host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32[[:space:]]+)scram-sha-256|\1trust|; s|^(host[[:space:]]+all[[:space:]]+all[[:space:]]+::1/128[[:space:]]+)scram-sha-256|\1trust|' \
  "$HBA"

sudo pg_ctlcluster "$PG_VER" main start || true
for _ in $(seq 1 30); do pg_isready -h localhost -q && break; sleep 1; done
sudo pg_ctlcluster "$PG_VER" main reload || true

echo "==> Ensuring database role and dev database exist"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ubuntu'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ubuntu LOGIN SUPERUSER;"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ecclesiastical_lineage_dev'" | grep -q 1 \
  || sudo -u postgres createdb -O ubuntu ecclesiastical_lineage_dev

echo "==> Writing .env (if absent)"
if [ ! -f .env ]; then
  cat > .env <<'EOF'
SECRET_KEY=dev-secret-key-change-me
FLASK_ENV=development
FLASK_DEBUG=True
DATABASE_URL=postgresql://localhost:5432/ecclesiastical_lineage_dev
PORT=5001
DEBUG=True
AUTO_MIGRATE_ON_STARTUP=true
EOF
fi

echo "==> Building schema and aligning Alembic version"
set -a; . ./.env; set +a
export FLASK_APP=app.py
# app import runs db.create_all() to build the current schema; stamp head so
# `flask db upgrade` and AUTO_MIGRATE_ON_STARTUP see the schema as current.
./env/bin/flask db stamp head

echo "==> install.sh complete"
