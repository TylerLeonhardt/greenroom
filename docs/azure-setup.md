# Azure Infrastructure Setup

Step-by-step guide to deploying My Call Time on Azure Container Apps.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- GitHub repo with secrets configured (see Step 7)
- Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create Resource Group

```bash
az group create --name greenroom-rg --location eastus
```

## Step 2: Create Container Registry (Basic tier ~$5/mo)

```bash
az acr create --name greenroomcr --resource-group greenroom-rg --sku Basic --admin-enabled true
```

Get the credentials (you'll need these for GitHub Secrets):

```bash
az acr credential show --name greenroomcr
```

## Step 3: Create PostgreSQL Flexible Server (~$13/mo)

```bash
az postgres flexible-server create \
  --name greenroom-db \
  --resource-group greenroom-rg \
  --location eastus \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --storage-size 32 \
  --version 16 \
  --admin-user greenroomadmin \
  --admin-password <GENERATE_SECURE_PASSWORD> \
  --yes
```

Create the database:

```bash
az postgres flexible-server db create \
  --server-name greenroom-db \
  --resource-group greenroom-rg \
  --database-name greenroom
```

Allow Azure services to connect:

```bash
az postgres flexible-server firewall-rule create \
  --server-name greenroom-db \
  --resource-group greenroom-rg \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

## Step 4: Create Container Apps Environment

```bash
az containerapp env create \
  --name greenroom-env \
  --resource-group greenroom-rg \
  --location eastus
```

## Step 5: Create Container App

```bash
az containerapp create \
  --name greenroom \
  --resource-group greenroom-rg \
  --environment greenroom-env \
  --image greenroomcr.azurecr.io/greenroom:latest \
  --registry-server greenroomcr.azurecr.io \
  --registry-username <ACR_USERNAME> \
  --registry-password <ACR_PASSWORD> \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars \
    DATABASE_URL="postgresql://greenroomadmin:<PASSWORD>@greenroom-db.postgres.database.azure.com:5432/greenroom?sslmode=require" \
    SESSION_SECRET="<GENERATE_SECRET>" \
    GOOGLE_CLIENT_ID="<FROM_GOOGLE_CLOUD_CONSOLE>" \
    GOOGLE_CLIENT_SECRET="<FROM_GOOGLE_CLOUD_CONSOLE>" \
    APP_URL="https://greenroom.<GENERATED>.azurecontainerapps.io" \
    NODE_ENV="production"
```

## Step 6: Run Database Migrations

From your local machine (or as a one-time container job):

```bash
DATABASE_URL="postgresql://greenroomadmin:<PASSWORD>@greenroom-db.postgres.database.azure.com:5432/greenroom?sslmode=require" \
  pnpm run db:migrate
```

> **Note:** You may need to add your local IP to the PostgreSQL firewall rules first:
> ```bash
> az postgres flexible-server firewall-rule create \
>   --server-name greenroom-db \
>   --resource-group greenroom-rg \
>   --name AllowMyIP \
>   --start-ip-address <YOUR_IP> \
>   --end-ip-address <YOUR_IP>
> ```

## Step 7: Configure GitHub Secrets

Create a service principal for CI/CD:

```bash
az ad sp create-for-rbac --name greenroom-ci \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/greenroom-rg \
  --json-auth
```

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | Full JSON output from `az ad sp create-for-rbac` |
| `ACR_LOGIN_SERVER` | `greenroomcr.azurecr.io` |
| `ACR_USERNAME` | From `az acr credential show --name greenroomcr` |
| `ACR_PASSWORD` | From `az acr credential show --name greenroomcr` |
| `ACR_NAME` | `greenroomcr` |
| `AZURE_RESOURCE_GROUP` | `greenroom-rg` |

## Health Check

Configure the Container App health probe to use the built-in health endpoint:

```bash
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars ... \
  --container-name greenroom \
  --set "configuration.ingress.customDomains=[]"
```

The health endpoint is available at `GET /api/health` and returns:

```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

## Estimated Monthly Costs

| Service | Tier | Cost |
|---------|------|------|
| Container Registry | Basic | ~$5/mo |
| PostgreSQL Flexible Server | B1ms (Burstable) | ~$13/mo |
| Container Apps | Consumption (scale to zero) | ~$5–20/mo |
| Communication Services Email | Pay-as-you-go | ~$2–5/mo |
| **Total** | | **~$25–43/mo** |
