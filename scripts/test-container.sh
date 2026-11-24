#!/usr/bin/env bash
set -euo pipefail

# CI-only: all names, credentials, certificates, and databases are disposable.
test "${CI:-}" = "true"
EVIDENCE="$RUNNER_TEMP/greenroom-container-evidence"
TLS="$RUNNER_TEMP/greenroom-container-tls"
mkdir -p "$EVIDENCE" "$TLS"

cleanup() {
  for container in greenroom-ci-proxy greenroom-ci greenroom-ci-failed greenroom-ci-postgres; do
    if docker inspect "$container" >/dev/null 2>&1; then
      docker logs "$container" > "$EVIDENCE/$container.log" 2>&1
      docker inspect --format '{{json .State}}' "$container" > "$EVIDENCE/$container.state.json"
      docker rm --force "$container" >/dev/null
    fi
  done
  docker network rm greenroom-ci-network >/dev/null
}
trap cleanup EXIT

docker pull postgres:16
docker pull nginx:alpine
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj '/CN=postgres' -addext 'subjectAltName=DNS:postgres,DNS:localhost,IP:127.0.0.1' \
  -keyout "$TLS/server.key" -out "$TLS/server.crt"
docker network create --internal greenroom-ci-network
test "$(docker network inspect --format '{{.Internal}}' greenroom-ci-network)" = true
# Host-side seed queries need a published port on a non-internal interface.
# Only the database and HTTPS test ingress get that interface, never the app.
docker create --name greenroom-ci-postgres --network bridge \
  --publish 127.0.0.1:5432:5432 \
  --env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=postgres --env POSTGRES_DB=greenroom \
  --volume "$TLS:/test-tls:ro" postgres:16 sh -ec '
    cp /test-tls/server.key /test-tls/server.crt /tmp/
    chown postgres:postgres /tmp/server.key /tmp/server.crt
    chmod 600 /tmp/server.key
    exec docker-entrypoint.sh postgres -c ssl=on \
      -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key
  '
docker network connect --alias postgres greenroom-ci-network greenroom-ci-postgres
docker start greenroom-ci-postgres
timeout 60s bash -c \
  'until docker exec greenroom-ci-postgres pg_isready -h 127.0.0.1 -U postgres -d greenroom; do sleep 1; done'

# Trust only the disposable PostgreSQL certificate; retain NODE_ENV=production
# and the real TLS verification path without changing production code.
docker run --detach --name greenroom-ci --network greenroom-ci-network \
  --volume "$TLS/server.crt:/app/certs/DigiCertGlobalRootG2.crt.pem:ro" \
  --env DATABASE_URL=postgresql://postgres:postgres@postgres:5432/greenroom \
  --env SESSION_SECRET --env GOOGLE_CLIENT_ID --env GOOGLE_CLIENT_SECRET --env APP_URL \
  greenroom:ci
docker inspect --format '{{json .NetworkSettings.Networks}}' greenroom-ci \
  > "$EVIDENCE/app-networks.json"
app_ip=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' greenroom-ci)
# Internal-only bridges intentionally do not publish host ports. Terminate TLS
# at a separate test ingress, like ACA, so browsers also exercise Secure cookies.
cat > "$TLS/proxy.conf" <<EOF
events {}
http {
  server {
    listen 443 ssl;
    ssl_certificate /test-tls/server.crt;
    ssl_certificate_key /test-tls/server.key;
    location / {
      proxy_pass http://$app_ip:3000;
      proxy_set_header Host \$http_host;
      proxy_set_header X-Forwarded-Proto https;
    }
  }
}
EOF
docker create --name greenroom-ci-proxy --network bridge \
  --publish 127.0.0.1:5176:443 --volume "$TLS:/test-tls:ro" \
  --volume "$TLS/proxy.conf:/etc/nginx/nginx.conf:ro" nginx:alpine
docker network connect greenroom-ci-network greenroom-ci-proxy
docker start greenroom-ci-proxy
timeout 60s bash -c '
  until curl --fail --silent --cacert "$2/server.crt" https://localhost:5176/api/health > "$1/health.json"; do
    test "$(docker inspect --format "{{.State.Running}}" greenroom-ci)" = true || exit 1
    sleep 1
  done
' _ "$EVIDENCE" "$TLS"
jq -e '.status == "ok"' "$EVIDENCE/health.json"
curl --fail --silent --show-error --cacert "$TLS/server.crt" https://localhost:5176/ \
  > "$EVIDENCE/landing.html"
grep -q 'My Call Time' "$EVIDENCE/landing.html"
test "$(docker exec greenroom-ci-postgres psql -U postgres -d greenroom -Atc \
  'SELECT count(*) FROM drizzle.__drizzle_migrations')" = "$(jq '.entries | length' drizzle/meta/_journal.json)"
docker logs greenroom-ci > "$EVIDENCE/startup.log" 2>&1
awk '
  /Migrations applied successfully/ { migrated=1 }
  /\[remix-serve\]/ { if (!migrated) exit 1; served=1 }
  END { if (!served) exit 1 }
' "$EVIDENCE/startup.log"
! grep -Ei 'Corepack.*download|Downloading.*pnpm' "$EVIDENCE/startup.log"
docker exec greenroom-ci node --input-type=module -e '
  import assert from "node:assert/strict";
  import fs from "node:fs";
  const args = fs.readFileSync("/proc/1/cmdline", "utf8").split("\0").filter(Boolean);
  assert.equal(args[0], "node");
  assert.equal(args[1], "node_modules/@remix-run/serve/dist/cli.js");
  assert.equal(args[2], "./build/server/index.js");
  assert.equal(process.env.NODE_ENV, "production");
  console.log("PID 1:", args);
' | tee "$EVIDENCE/pid1.txt"

# A real SQL migration error must fail closed, not just an unreachable host.
docker exec greenroom-ci-postgres psql -U postgres -c 'CREATE DATABASE migration_failure;'
docker exec greenroom-ci-postgres psql -U postgres -d migration_failure -c \
  'CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (broken integer);'
docker run --detach --name greenroom-ci-failed --network greenroom-ci-network \
  --volume "$TLS/server.crt:/app/certs/DigiCertGlobalRootG2.crt.pem:ro" \
  --env DATABASE_URL=postgresql://postgres:postgres@postgres:5432/migration_failure \
  --env SESSION_SECRET --env GOOGLE_CLIENT_ID --env GOOGLE_CLIENT_SECRET --env APP_URL \
  greenroom:ci
timeout 30s docker wait greenroom-ci-failed > "$EVIDENCE/migration-failure.exit"
test "$(cat "$EVIDENCE/migration-failure.exit")" = 1
docker logs greenroom-ci-failed > "$EVIDENCE/migration-failure.log" 2>&1
grep -q 'Migration failed:' "$EVIDENCE/migration-failure.log"
! grep -E 'Migrations applied successfully|\[remix-serve\]' "$EVIDENCE/migration-failure.log"

pnpm test:e2e:ci

# Use TERM, never docker stop's implicit KILL fallback.
started=$SECONDS
docker kill --signal TERM greenroom-ci
timeout 15s docker wait greenroom-ci > "$EVIDENCE/sigterm.exit"
test "$(cat "$EVIDENCE/sigterm.exit")" = 0
test "$(docker inspect --format '{{.State.OOMKilled}}' greenroom-ci)" = false
printf 'SIGTERM shutdown: %s seconds; exit 0; no SIGKILL\n' "$((SECONDS - started))" \
  | tee "$EVIDENCE/sigterm.txt"
