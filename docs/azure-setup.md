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

## Managed Identity for ACS Email (#215)

Greenroom sends email through Azure Communication Services (ACS). It currently authenticates with
the shared-key `AZURE_COMMUNICATION_CONNECTION_STRING`, whose HMAC signature includes the host
clock-derived `x-ms-date` header; this caused a production clock-skew incident. Issue #215 migrates
email authentication to Azure Managed Identity using an Azure AD `TokenCredential`, removing
host-clock HMAC signing entirely.

The migration is a small behind-the-seam constructor swap.
`app/services/email.server.ts` creates the email client through
`createSkewTolerantEmailClient()` in `app/services/acs-email-auth.server.ts`, which currently calls
`new EmailClient(connectionString, { httpClient })`. The installed
`@azure/communication-email@1.1.0` client also supports
`new EmailClient(endpoint, TokenCredential, options)`, so the managed-identity path can remove the
custom HMAC `httpClient`. `@azure/identity` is not yet a project dependency.

### Why managed identity

Managed identity replaces the clock-sensitive shared-key HMAC signature with an Azure AD access
token. Because the host clock no longer generates an `x-ms-date` value for HMAC signing, the
clock-skew failure mode from the production incident is removed.

### Provisioning steps (ops action, run once)

Run these commands in order while authenticated to the subscription that owns the resources.

1. Enable the Container App's system-assigned identity:

   ```bash
   az containerapp identity assign \
     --name greenroom \
     --resource-group greenroom-rg \
     --system-assigned
   ```

2. Capture its principal ID:

   ```bash
   PRINCIPAL_ID=$(az containerapp identity show \
     --name greenroom \
     --resource-group greenroom-rg \
     --query principalId \
     -o tsv)
   ```

3. Set the subscription ID and ACS resource scope:

   ```bash
   SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:?Set AZURE_SUBSCRIPTION_ID first}"
   ACS_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/greenroom-rg/providers/Microsoft.Communication/CommunicationServices/greenroom-comm"
   ```

4. Grant the identity permission to send email, scoped only to the ACS resource:

   ```bash
   az role assignment create \
     --assignee-object-id "$PRINCIPAL_ID" \
     --assignee-principal-type ServicePrincipal \
     --role "Communication Services Email Sender" \
     --scope "$ACS_ID"
   ```

5. Verify the assignment:

   ```bash
   az role assignment list --scope "$ACS_ID"
   ```

RBAC propagation can take up to approximately 5 minutes after the role assignment is created.

### App configuration

Issue #215 introduces `AZURE_COMMUNICATION_ENDPOINT`, set to the ACS endpoint URL (for example,
`https://greenroom-comm.communication.azure.com`). The intended authentication selection is:

- If `AZURE_COMMUNICATION_ENDPOINT` is set, use `DefaultAzureCredential` and managed identity.
- Otherwise, fall back to `AZURE_COMMUNICATION_CONNECTION_STRING` and shared-key authentication.

Keep both variables set for the first managed-identity release. This preserves an immediate
configuration-only rollback path: unset `AZURE_COMMUNICATION_ENDPOINT` to select the existing
shared-key path.

### Validation (cannot be tested in CI)

Managed-identity authentication cannot be exercised locally or in CI because those environments do
not have the Container App's Azure AD identity. Live acceptance requires all of the following:

1. Deploy the managed-identity implementation and configuration.
2. Trigger a real email, such as a magic-link or verification email.
3. In Application Insights, observe `customEvents` where `name == "EmailSent"` and
   `customDimensions.success == "true"`.
4. Confirm a clean observation window has no `errorKind=clock_skew` events and exception volume
   remains at its baseline.

### Rollback

Unset `AZURE_COMMUNICATION_ENDPOINT` to fall back to shared-key authentication through
`AZURE_COMMUNICATION_CONNECTION_STRING`. If both variables were retained, this configuration
change does not require a redeploy.

## Email Deliverability (Custom Domain)

My Call Time sends emails from `DoNotReply@mycalltime.app` via Azure Communication Services. For emails to actually be delivered (and not land in spam), your custom domain needs SPF, DKIM, and DMARC DNS records.

> **Quick workaround:** If you need emails flowing immediately without DNS setup, change the sender address in `app/services/email.server.ts` to use Azure's default domain: `DoNotReply@<your-acs-resource-id>.azurecomm.net`. This works out of the box but looks less professional.

### Step 1: Add a Custom Domain in Azure Communication Services

1. Go to **Azure Portal** → your **Communication Services** resource
2. In the left sidebar, go to **Email** → **Domains**
3. Click **Add domain** → **Custom domain**
4. Enter your domain (e.g., `mycalltime.app`) and click **Add**
5. Azure will show you the DNS records you need to add — keep this page open

### Step 2: Add DNS Records

Add the following records at your DNS provider (e.g., Cloudflare, Namecheap, Route 53):

#### SPF Record

Authorizes Azure Communication Services to send email on behalf of your domain.

| Type | Name | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:azurecomm.net ~all` |

> If you already have an SPF record, add `include:azurecomm.net` before the `~all` or `-all` in your existing record. A domain can only have one SPF TXT record.

#### DKIM Records

DKIM cryptographically signs your emails so recipients can verify they haven't been tampered with. Azure generates two CNAME records during domain verification — you'll find them on the domain verification page from Step 1.

| Type | Name | Value |
|------|------|-------|
| CNAME | `selector1-azurecomm-prod-net._domainkey` | *(copy from Azure portal)* |
| CNAME | `selector2-azurecomm-prod-net._domainkey` | *(copy from Azure portal)* |

> The exact CNAME names and values are unique to your domain. Copy them directly from the Azure portal — do not guess.

#### DMARC Record

Tells receiving mail servers what to do with emails that fail SPF/DKIM checks.

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine;` |

> `p=quarantine` tells receivers to flag suspicious emails as spam rather than silently dropping them. Once you've confirmed everything works, you can tighten this to `p=reject`.

### Step 3: Verify Domain in Azure

1. After adding all DNS records, go back to the Azure portal domain verification page
2. Click **Verify** for each record type (SPF, DKIM, DMARC)
3. DNS propagation can take up to 48 hours, but usually completes within 15–30 minutes
4. All three should show a green checkmark ✅ when verified

### Step 4: Configure the Sender Address

1. In the Azure portal, go to **Communication Services** → **Email** → **Domains** → your verified domain
2. Click **MailFrom addresses** → **Add**
3. Add `DoNotReply` as the MailFrom address (this creates `DoNotReply@mycalltime.app`)
4. The sender address in `app/services/email.server.ts` should match:

```typescript
const senderAddress = "DoNotReply@mycalltime.app";
```

### Verifying DNS Records

Use these tools to confirm your records are set up correctly:

```bash
# Check SPF record
dig TXT mycalltime.app +short
# Should include: "v=spf1 include:azurecomm.net ~all"

# Check DKIM records
dig CNAME selector1-azurecomm-prod-net._domainkey.mycalltime.app +short
dig CNAME selector2-azurecomm-prod-net._domainkey.mycalltime.app +short

# Check DMARC record
dig TXT _dmarc.mycalltime.app +short
# Should return: "v=DMARC1; p=quarantine;"
```

On Windows (or if you don't have `dig`):

```bash
nslookup -type=TXT mycalltime.app
nslookup -type=CNAME selector1-azurecomm-prod-net._domainkey.mycalltime.app
nslookup -type=TXT _dmarc.mycalltime.app
```

You can also use [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) to check all records in a browser:
- Enter `mycalltime.app` and select **SPF Record Lookup**
- Enter `_dmarc.mycalltime.app` and select **DMARC Lookup**

## Estimated Monthly Costs

| Service | Tier | Cost |
|---------|------|------|
| Container Registry | Basic | ~$5/mo |
| PostgreSQL Flexible Server | B1ms (Burstable) | ~$13/mo |
| Container Apps | Consumption (scale to zero) | ~$5–20/mo |
| Communication Services Email | Pay-as-you-go | ~$2–5/mo |
| **Total** | | **~$25–43/mo** |
