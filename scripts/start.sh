#!/bin/sh
set -eu

node scripts/migrate.mjs
exec node node_modules/@remix-run/serve/dist/cli.js ./build/server/index.js
