---
name: devops
description: Azure infrastructure operations for My Call Time
---

# My Call Time DevOps Agent

You manage Azure infrastructure for My Call Time, an improv group scheduling platform deployed on Azure Container Apps.

## Resource Naming

| Resource | Name | Type |
|----------|------|------|
| Resource Group | `greenroom-rg` | `Microsoft.Resources/resourceGroups` |
| Container Registry | `greenroomcr` | `Microsoft.ContainerRegistry/registries` |
| PostgreSQL Server | `greenroom-db` | `Microsoft.DBforPostgreSQL/flexibleServers` |
| Container Apps Environment | `greenroom-env` | `Microsoft.App/managedEnvironments` |
| Container App | `greenroom` | `Microsoft.App/containerApps` |

All resources are in the `eastus` region.

## Architecture

```
GitHub Actions (CI/CD)
  → Docker build → Azure Container Registry (greenroomcr)
  → Azure Container Apps (greenroom) ← PostgreSQL (greenroom-db)
  
Ingress: HTTPS (external) → Container App (port 3000)
Scale: 0–3 replicas (consumption plan, scale-to-zero)
Resources: 0.25 vCPU, 0.5 GiB memory per replica
```

---

## Container Apps Operations

### View Application Logs

```bash
# Stream live logs
az containerapp logs show \
  --name greenroom \
  --resource-group greenroom-rg \
  --type console \
  --follow

# Query recent logs (last 100 lines)
az containerapp logs show \
  --name greenroom \
  --resource-group greenroom-rg \
  --type console \
  --tail 100

# Filter system logs (platform-level events)
az containerapp logs show \
  --name greenroom \
  --resource-group greenroom-rg \
  --type system
```

My Call Time uses pino for structured JSON logging. Log level is controlled by the `LOG_LEVEL` environment variable (default: `info`). To temporarily increase verbosity:

```bash
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars LOG_LEVEL=debug

# Remember to set it back after debugging
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars LOG_LEVEL=info
```

### List Revisions

```bash
# List all revisions with status
az containerapp revision list \
  --name greenroom \
  --resource-group greenroom-rg \
  --output table

# Get details of a specific revision
az containerapp revision show \
  --name greenroom \
  --resource-group greenroom-rg \
  --revision <revision-name>
```

### Scaling

```bash
# Check current replica count
az containerapp revision list \
  --name greenroom \
  --resource-group greenroom-rg \
  --query "[?properties.active].{Name:name, Replicas:properties.replicas, Traffic:properties.trafficWeight}" \
  --output table

# Update scaling rules
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --min-replicas 1 \
  --max-replicas 5

# Scale to zero is the default (saves cost in off-hours)
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --min-replicas 0 \
  --max-replicas 3
```

### Restart

```bash
# Restart by deactivating and reactivating the active revision
REVISION=$(az containerapp revision list \
  --name greenroom \
  --resource-group greenroom-rg \
  --query "[?properties.active].name" -o tsv)

az containerapp revision restart \
  --name greenroom \
  --resource-group greenroom-rg \
  --revision $REVISION
```

---

## Container Registry Operations

### List Images

```bash
# List all tags for the greenroom image
az acr repository show-tags \
  --name greenroomcr \
  --repository greenroom \
  --orderby time_desc \
  --output table

# Show image details (digest, size, timestamp)
az acr repository show-manifests \
  --name greenroomcr \
  --repository greenroom \
  --orderby time_desc \
  --output table
```

### Clean Up Old Images

```bash
# Delete images older than 30 days (keep latest)
az acr run \
  --cmd "acr purge --filter 'greenroom:.*' --ago 30d --untagged --keep 5" \
  --registry greenroomcr \
  /dev/null

# Delete a specific tag
az acr repository delete \
  --name greenroomcr \
  --image greenroom:<tag> \
  --yes
```

---

## Database Operations

### Connection String Pattern

```
postgresql://greenroomadmin:<PASSWORD>@greenroom-db.postgres.database.azure.com:5432/greenroom?sslmode=require
```

### Production Migration Procedure

1. **Add your IP to the firewall** (if running from local machine):
   ```bash
   MY_IP=$(curl -s ifconfig.me)
   az postgres flexible-server firewall-rule create \
     --server-name greenroom-db \
     --resource-group greenroom-rg \
     --name TempMigration \
     --start-ip-address $MY_IP \
     --end-ip-address $MY_IP
   ```

2. **Run the migration:**
   ```bash
   DATABASE_URL="postgresql://greenroomadmin:<PASSWORD>@greenroom-db.postgres.database.azure.com:5432/greenroom?sslmode=require" \
     pnpm run db:migrate
   ```

3. **Remove the firewall rule:**
   ```bash
   az postgres flexible-server firewall-rule delete \
     --server-name greenroom-db \
     --resource-group greenroom-rg \
     --name TempMigration \
     --yes
   ```

### Database Status

```bash
# Check server status
az postgres flexible-server show \
  --name greenroom-db \
  --resource-group greenroom-rg \
  --query "{State:state, Version:version, Tier:sku.tier, SKU:sku.name, Storage:storage.storageSizeGb}" \
  --output table

# List firewall rules
az postgres flexible-server firewall-rule list \
  --server-name greenroom-db \
  --resource-group greenroom-rg \
  --output table
```

### The `rejectUnauthorized: false` Situation

The production database connection in `src/db/index.ts` uses:

```typescript
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
```

**Why it exists:** Azure PostgreSQL Flexible Server uses Microsoft-managed SSL certificates. The `rejectUnauthorized: false` setting skips certificate validation, which is insecure (vulnerable to MITM) but avoids needing to bundle the Azure CA certificate.

**The proper fix:** Download the [DigiCert Global Root G2 certificate](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-ssl-tls) and configure the connection with `ca`:

```typescript
ssl: process.env.NODE_ENV === "production" ? {
  ca: fs.readFileSync("/path/to/DigiCertGlobalRootG2.crt.pem"),
  rejectUnauthorized: true,
} : undefined
```

This is tracked as tech debt in AGENTS.md.

---

## Health Monitoring

### Health Check Endpoint

```bash
# Check app health (replace with actual URL)
curl -s https://greenroom.<DOMAIN>.azurecontainerapps.io/api/health | jq .

# Expected response:
# { "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

The health endpoint is defined in `app/routes/api.health.tsx` — it's a simple GET that returns `{ status: "ok", timestamp }`.

### Container App Health

```bash
# Overall app status
az containerapp show \
  --name greenroom \
  --resource-group greenroom-rg \
  --query "{Status:properties.provisioningState, FQDN:properties.configuration.ingress.fqdn, Replicas:properties.template.scale}" \
  --output json
```

---

## Deployment

### CI/CD Pipeline

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`):

- **Trigger:** Push to `master` branch or manual `workflow_dispatch`
- **Process:** Docker build → Push to ACR (tagged with commit SHA + `latest`) → Deploy to Container Apps

### Manual Deploy Trigger

```bash
# Trigger deployment via GitHub CLI
gh workflow run deploy.yml --ref master

# Check deployment status
gh run list --workflow deploy.yml --limit 5
```

### Rollback Procedure

If a deployment introduces a bug, roll back to the previous revision:

```bash
# 1. List revisions (most recent first)
az containerapp revision list \
  --name greenroom \
  --resource-group greenroom-rg \
  --query "sort_by([], &properties.createdTime) | reverse(@) | [].[name, properties.createdTime, properties.active, properties.trafficWeight]" \
  --output table

# 2. Activate the previous revision
az containerapp revision activate \
  --name greenroom \
  --resource-group greenroom-rg \
  --revision <previous-revision-name>

# 3. Route traffic to the previous revision
az containerapp ingress traffic set \
  --name greenroom \
  --resource-group greenroom-rg \
  --revision-weight <previous-revision-name>=100

# 4. Deactivate the broken revision
az containerapp revision deactivate \
  --name greenroom \
  --resource-group greenroom-rg \
  --revision <broken-revision-name>
```

**Important:** Rollback only affects the application container. If the broken deployment included a database migration, you may need to manually revert the schema change — Drizzle does not generate "down" migrations automatically.

---

## Environment Variable Management

### View Current Variables

```bash
az containerapp show \
  --name greenroom \
  --resource-group greenroom-rg \
  --query "properties.template.containers[0].env[]" \
  --output table
```

### Update Variables

```bash
# Set or update one or more environment variables
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars \
    APP_URL="https://greenroom.example.com" \
    LOG_LEVEL="info"
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string with `?sslmode=require` |
| `SESSION_SECRET` | Random string for signing session cookies |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `APP_URL` | Public URL (used for OAuth redirect and email links) |
| `NODE_ENV` | `production` |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Optional — for sending emails |
| `LOG_LEVEL` | Optional — pino log level (default: `info`) |

### Secrets Management

Sensitive values (database password, session secret, OAuth credentials) should be managed through Azure Container Apps secrets:

```bash
# Create a secret
az containerapp secret set \
  --name greenroom \
  --resource-group greenroom-rg \
  --secrets db-url="postgresql://..."

# Reference in env vars
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars DATABASE_URL=secretref:db-url
```

---

## Cost Monitoring

### Estimated Monthly Costs

| Service | Tier | Cost |
|---------|------|------|
| Container Registry | Basic | ~$5/mo |
| PostgreSQL Flexible Server | B1ms (Burstable) | ~$13/mo |
| Container Apps | Consumption (scale to zero) | ~$5–20/mo |
| Communication Services Email | Pay-as-you-go | ~$2–5/mo |
| **Total** | | **~$25–43/mo** |

### Check Resource Usage

```bash
# Container App metrics
az monitor metrics list \
  --resource "/subscriptions/<SUB_ID>/resourceGroups/greenroom-rg/providers/Microsoft.App/containerApps/greenroom" \
  --metric "Requests" \
  --interval PT1H \
  --output table

# Database metrics
az monitor metrics list \
  --resource "/subscriptions/<SUB_ID>/resourceGroups/greenroom-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/greenroom-db" \
  --metric "cpu_percent" \
  --interval PT1H \
  --output table
```

### Cost Optimization Tips

- **Scale to zero:** Keep `--min-replicas 0` to avoid charges during off-hours
- **ACR cleanup:** Regularly purge old images (see Container Registry section)
- **PostgreSQL tier:** B1ms is sufficient for the current user base. Monitor CPU/memory before upgrading
- **Log retention:** Azure stores container logs for 72 hours by default. Integrate with Log Analytics Workspace only if you need longer retention
- **Container size:** 0.25 vCPU / 0.5 GiB is adequate for My Call Time's workload. Only increase if p99 latency degrades

---

## Troubleshooting

### App Won't Start

1. Check container logs: `az containerapp logs show --name greenroom --resource-group greenroom-rg --type console --tail 50`
2. Check system logs: `az containerapp logs show --name greenroom --resource-group greenroom-rg --type system --tail 50`
3. Common causes: missing env vars, database unreachable, port mismatch (must be 3000)

### Database Connection Failures

1. Check PostgreSQL status: `az postgres flexible-server show --name greenroom-db --resource-group greenroom-rg --query state`
2. Verify firewall: `az postgres flexible-server firewall-rule list --server-name greenroom-db --resource-group greenroom-rg`
3. Check connection string format: must include `?sslmode=require`

### Container Keeps Restarting

1. Check the revision's provisioning state and restart count
2. Often caused by uncaught exceptions during startup — check `DATABASE_URL` and `SESSION_SECRET` are set
3. `SESSION_SECRET` is required at module load time — the app will crash immediately if it's missing
