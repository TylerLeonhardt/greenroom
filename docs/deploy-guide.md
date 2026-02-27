# 🚀 GreenRoom Deployment Guide

> **Who this is for:** You have a Mac, an Azure account with ~$150/month credit, and you want GreenRoom running on the internet. No infrastructure experience needed.
>
> **Time:** ~30–60 minutes for Part 1. Parts 2–4 are optional but recommended.
>
> **Total monthly cost:** ~$25–43/month (well within your $150 credit).

---

## Part 1: One-Time Setup (Deploy GreenRoom to Azure)

### Step 1: Install the Azure CLI

The Azure CLI is a command-line tool that lets you create and manage Azure resources from your terminal.

- [ ] Open Terminal on your Mac and run:

```bash
brew install azure-cli
```

> **Already have it?** Run `az version` — if you see output, skip this step.

---

### Step 2: Log In to Azure

This opens your browser so you can sign in with your Azure account.

- [ ] Run:

```bash
az login
```

A browser window will open. Sign in with your Azure account, then come back to the terminal.

- [ ] Note your **subscription ID** from the output (it looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). You'll need it later.

---

### Step 3: Create a Resource Group

A resource group is just a folder in Azure that holds all your GreenRoom stuff together.

- [ ] Run:

```bash
az group create --name greenroom-rg --location eastus
```

---

### Step 4: Create a Container Registry (~$5/month)

This is where your app's Docker image gets stored. Think of it like a private app store for your code.

- [ ] Run:

```bash
az acr create \
  --name greenroomcr \
  --resource-group greenroom-rg \
  --sku Basic \
  --admin-enabled true
```

- [ ] Save the registry credentials (you'll need these later):

```bash
az acr credential show --name greenroomcr
```

> 📝 **Save this somewhere safe!** Write down the `username` and one of the `passwords`. You'll need them in Part 2.

---

### Step 5: Create a PostgreSQL Database (~$13/month)

This is where all your group, availability, and event data is stored.

- [ ] First, generate a strong password for the database:

```bash
openssl rand -base64 24
```

> 📝 **Save this password somewhere safe!** You will need it multiple times below. We'll call it `YOUR_DB_PASSWORD`.

- [ ] Create the database server (this takes **3–5 minutes** — grab a coffee ☕):

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
  --admin-password 'YOUR_DB_PASSWORD' \
  --yes
```

> ⚠️ Replace `YOUR_DB_PASSWORD` with the password you generated above (keep the quotes).

- [ ] Create the `greenroom` database inside that server:

```bash
az postgres flexible-server db create \
  --server-name greenroom-db \
  --resource-group greenroom-rg \
  --database-name greenroom
```

- [ ] Allow Azure services (like your app) to connect to the database:

```bash
az postgres flexible-server firewall-rule create \
  --server-name greenroom-db \
  --resource-group greenroom-rg \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

---

### Step 6: Create the Container Apps Environment

Container Apps is the service that actually runs your app. The "environment" is the space where it lives.

- [ ] Run (this takes **1–2 minutes**):

```bash
az containerapp env create \
  --name greenroom-env \
  --resource-group greenroom-rg \
  --location eastus
```

---

### Step 7: Build and Push the Docker Image

This packages your app into a Docker image and uploads it to your Container Registry.

- [ ] Make sure you're in the greenroom project folder, then run:

```bash
az acr build \
  --registry greenroomcr \
  --image greenroom:latest \
  --file Dockerfile .
```

> This builds the image in the cloud (no need for Docker Desktop on your Mac). Takes **2–3 minutes**.

---

### Step 8: Generate a Session Secret

This is a random string used to encrypt user sessions (login cookies).

- [ ] Generate it:

```bash
openssl rand -hex 32
```

> 📝 **Save this somewhere safe!** We'll call it `YOUR_SESSION_SECRET`.

---

### Step 9: Deploy the Container App

This creates the actual running app with all its settings. It will be accessible on the internet when this finishes.

- [ ] First, get your ACR credentials:

```bash
az acr credential show --name greenroomcr --query "{username:username, password:passwords[0].value}" --output tsv
```

- [ ] Now create the Container App (replace **all** the placeholders):

```bash
az containerapp create \
  --name greenroom \
  --resource-group greenroom-rg \
  --environment greenroom-env \
  --image greenroomcr.azurecr.io/greenroom:latest \
  --registry-server greenroomcr.azurecr.io \
  --registry-username YOUR_ACR_USERNAME \
  --registry-password 'YOUR_ACR_PASSWORD' \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --env-vars \
    DATABASE_URL="postgresql://greenroomadmin:YOUR_DB_PASSWORD@greenroom-db.postgres.database.azure.com:5432/greenroom?sslmode=require" \
    SESSION_SECRET="YOUR_SESSION_SECRET" \
    GOOGLE_CLIENT_ID="placeholder" \
    GOOGLE_CLIENT_SECRET="placeholder" \
    APP_URL="https://placeholder.azurecontainerapps.io" \
    NODE_ENV="production"
```

> **Replace these placeholders:**
> - `YOUR_ACR_USERNAME` — from Step 4
> - `YOUR_ACR_PASSWORD` — from Step 4
> - `YOUR_DB_PASSWORD` — from Step 5
> - `YOUR_SESSION_SECRET` — from Step 8
>
> We'll fix `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `APP_URL` after deployment.

- [ ] Get your app's URL:

```bash
az containerapp show \
  --name greenroom \
  --resource-group greenroom-rg \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv
```

Your URL will look like: `https://greenroom.randomstring123.azurecontainerapps.io`

> 📝 **Save this URL!** We'll call it `YOUR_APP_URL`.

- [ ] Now update the `APP_URL` environment variable with the real URL:

```bash
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars APP_URL="https://YOUR_APP_URL"
```

> Replace `YOUR_APP_URL` with the full URL from above (include the `https://`).

---

### Step 10: Run Database Migrations

This creates all the tables your app needs in the database.

- [ ] First, allow your Mac to connect to the database. Find your public IP:

```bash
curl -s ifconfig.me
```

- [ ] Add your IP to the database firewall:

```bash
az postgres flexible-server firewall-rule create \
  --server-name greenroom-db \
  --resource-group greenroom-rg \
  --name AllowMyMac \
  --start-ip-address YOUR_PUBLIC_IP \
  --end-ip-address YOUR_PUBLIC_IP
```

> Replace `YOUR_PUBLIC_IP` with the IP from the `curl` command above.

- [ ] Run the migrations from your greenroom project folder:

```bash
DATABASE_URL="postgresql://greenroomadmin:YOUR_DB_PASSWORD@greenroom-db.postgres.database.azure.com:5432/greenroom?sslmode=require" \
  pnpm run db:migrate
```

> Replace `YOUR_DB_PASSWORD` with your database password from Step 5.

- [ ] (Optional) Remove the firewall rule for your Mac after migrations are done:

```bash
az postgres flexible-server firewall-rule delete \
  --server-name greenroom-db \
  --resource-group greenroom-rg \
  --name AllowMyMac \
  --yes
```

---

### Step 11: Verify It's Working

Let's make sure the app is actually running.

- [ ] Check the health endpoint:

```bash
curl https://YOUR_APP_URL/api/health
```

You should see:

```json
{"status":"ok","timestamp":"2026-02-27T..."}
```

🎉 **Congratulations!** GreenRoom is live on the internet. But Google login won't work yet — do Part 3 to set that up.

---

## Part 2: Set Up CI/CD (Auto-Deploy on Code Changes)

> This makes it so pushing code to the `master` branch automatically deploys to Azure. Takes ~10 minutes.

### Step 1: Create a Service Principal

A service principal is like a robot account that GitHub uses to deploy to Azure on your behalf.

- [ ] Get your subscription ID:

```bash
az account show --query id --output tsv
```

- [ ] Create the service principal:

```bash
az ad sp create-for-rbac \
  --name greenroom-ci \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/greenroom-rg \
  --json-auth
```

> Replace `YOUR_SUBSCRIPTION_ID` with your actual subscription ID.

> 📝 **Save the entire JSON output!** You'll paste this into GitHub in the next step.

---

### Step 2: Add GitHub Secrets

These are encrypted values that the CI/CD pipeline uses to deploy.

- [ ] Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add each of these secrets one at a time:

| Secret Name | Where to Get the Value |
|---|---|
| `AZURE_CREDENTIALS` | The **entire JSON blob** from Step 1 above |
| `ACR_LOGIN_SERVER` | `greenroomcr.azurecr.io` |
| `ACR_USERNAME` | Run: `az acr credential show --name greenroomcr --query username --output tsv` |
| `ACR_PASSWORD` | Run: `az acr credential show --name greenroomcr --query "passwords[0].value" --output tsv` |
| `ACR_NAME` | `greenroomcr` |
| `AZURE_RESOURCE_GROUP` | `greenroom-rg` |

---

### Step 3: Enable Auto-Deploy

The deploy workflow is currently set to **manual-only** (you have to click a button to deploy). Let's make it auto-deploy when you push to `master`.

- [ ] Open `.github/workflows/deploy.yml` in your editor and change the trigger:

**Before (manual only):**
```yaml
on:
  workflow_dispatch:
```

**After (auto-deploy on push to master + manual option):**
```yaml
on:
  push:
    branches: [master]
  workflow_dispatch:
```

> 💡 **When to do this:** Only enable auto-deploy after you've confirmed the app works (Part 1 Step 11) and the GitHub secrets are set (Part 2 Step 2). If auto-deploy is enabled without secrets, CI will fail on every push.

- [ ] Commit and push the change:

```bash
git add .github/workflows/deploy.yml
git commit -m "Enable auto-deploy on push to master"
git push
```

---

### Step 4: Verify CI/CD Works

- [ ] Go to your GitHub repo → **Actions** tab
- [ ] You should see a "Deploy" workflow running
- [ ] Wait for it to turn green ✅

From now on, every push to `master` automatically deploys your latest code.

---

## Part 3: Set Up Google OAuth (for Google Login)

> Without this, users can only sign up with email/password. Google login is recommended for a smoother experience. Takes ~15 minutes.

### Step 1: Go to Google Cloud Console

- [ ] Open [https://console.cloud.google.com](https://console.cloud.google.com)
- [ ] Sign in with your Google account

### Step 2: Create a Project

- [ ] Click the project dropdown at the top of the page
- [ ] Click **New Project**
- [ ] Name it `GreenRoom` and click **Create**
- [ ] Make sure the new project is selected in the dropdown

### Step 3: Set Up the OAuth Consent Screen

- [ ] In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
- [ ] Choose **External** and click **Create**
- [ ] Fill in:
  - **App name:** `GreenRoom`
  - **User support email:** your email
  - **Developer contact email:** your email
- [ ] Click **Save and Continue** through the remaining steps (Scopes, Test Users)
- [ ] On the Summary page, click **Back to Dashboard**

### Step 4: Create OAuth Credentials

- [ ] In the left sidebar, go to **APIs & Services** → **Credentials**
- [ ] Click **+ Create Credentials** → **OAuth client ID**
- [ ] Choose **Web application**
- [ ] Name it `GreenRoom`
- [ ] Under **Authorized redirect URIs**, click **+ Add URI** and enter:

```
https://YOUR_APP_URL/auth/google/callback
```

> Replace `YOUR_APP_URL` with your Container App URL from Part 1 Step 9.

- [ ] Click **Create**

> 📝 **Save the Client ID and Client Secret** — you'll need them in the next step.

### Step 5: Add Credentials to Your Container App

- [ ] Update the environment variables on your Container App:

```bash
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars \
    GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID" \
    GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
```

> Replace `YOUR_GOOGLE_CLIENT_ID` and `YOUR_GOOGLE_CLIENT_SECRET` with the values from Step 4.

- [ ] Verify Google login works by going to your app URL and clicking "Sign in with Google"

---

## Part 4: Optional — Custom Domain

> If you want `greenroom.yourdomain.com` instead of the auto-generated Azure URL. SSL certificates are free and automatic.

- [ ] Add a CNAME record in your DNS provider pointing your subdomain to your Container App URL:
  - **Type:** CNAME
  - **Name:** `greenroom` (or whatever subdomain you want)
  - **Value:** your Container App URL (e.g., `greenroom.randomstring.azurecontainerapps.io`)

- [ ] Add the custom domain to your Container App:

```bash
az containerapp hostname add \
  --name greenroom \
  --resource-group greenroom-rg \
  --hostname greenroom.yourdomain.com
```

- [ ] Bind a free managed SSL certificate:

```bash
az containerapp hostname bind \
  --name greenroom \
  --resource-group greenroom-rg \
  --hostname greenroom.yourdomain.com \
  --environment greenroom-env \
  --validation-method CNAME
```

- [ ] Update `APP_URL` to your custom domain:

```bash
az containerapp update \
  --name greenroom \
  --resource-group greenroom-rg \
  --set-env-vars APP_URL="https://greenroom.yourdomain.com"
```

- [ ] Don't forget to update the **Google OAuth redirect URI** in Google Cloud Console to use your custom domain too.

---

## Part 5: Cost Summary

Here's what you're paying for each month:

| Service | What It Does | Tier | Monthly Cost |
|---|---|---|---|
| Container Registry | Stores your Docker images | Basic | ~$5 |
| PostgreSQL | Your database | Burstable B1ms | ~$13 |
| Container Apps | Runs your app | Consumption (scales to zero) | ~$5–20 |
| Communication Services | Email notifications (optional) | Pay-as-you-go | ~$2–5 |
| **Total** | | | **~$25–43** |

> 💰 The Container App scales to zero when nobody is using it, so during off-hours you're only paying for the database and registry.

### How to Check Your Spending

- [ ] Go to [Azure Cost Management](https://portal.azure.com/#view/Microsoft_Azure_CostManagement/Menu/~/costanalysis)
- [ ] Filter by resource group: `greenroom-rg`
- [ ] You'll see a breakdown of exactly what each service costs

### Budget Alert (Recommended)

Set up an alert so Azure emails you if spending exceeds $50/month:

```bash
az consumption budget create \
  --budget-name greenroom-budget \
  --resource-group greenroom-rg \
  --amount 50 \
  --category cost \
  --time-grain monthly \
  --start-date 2026-03-01 \
  --end-date 2027-03-01
```

---

## Troubleshooting

### "My app won't start"

Check the Container App logs:

```bash
az containerapp logs show \
  --name greenroom \
  --resource-group greenroom-rg \
  --type system
```

### "Database connection error"

Make sure the firewall allows Azure services:

```bash
az postgres flexible-server firewall-rule list \
  --server-name greenroom-db \
  --resource-group greenroom-rg
```

You should see the `AllowAzureServices` rule with `0.0.0.0`.

### "Health check returns 503"

The database might not be ready. Check if migrations have been run (Part 1, Step 10). Also make sure the `DATABASE_URL` in your Container App env vars is correct.

### "Google login doesn't work"

1. Check that the redirect URI in Google Cloud Console exactly matches: `https://YOUR_APP_URL/auth/google/callback`
2. Verify the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars are set correctly on the Container App
3. If you set up a custom domain, update the redirect URI to use the custom domain

### "CI/CD deploy fails"

1. Check that all 6 GitHub secrets are set correctly (Part 2, Step 2)
2. Go to GitHub → Actions → click the failed run → click the failed job to see the error
3. Most common issue: expired ACR password. Regenerate with `az acr credential renew --name greenroomcr --password-name password`

---

## Quick Reference

| What | Command |
|---|---|
| Check app health | `curl https://YOUR_APP_URL/api/health` |
| View app logs | `az containerapp logs show --name greenroom --resource-group greenroom-rg` |
| Restart the app | `az containerapp revision restart --name greenroom --resource-group greenroom-rg` |
| Update env vars | `az containerapp update --name greenroom --resource-group greenroom-rg --set-env-vars KEY="VALUE"` |
| Run migrations | `DATABASE_URL="..." pnpm run db:migrate` |
| Check Azure spending | [Azure Cost Management](https://portal.azure.com/#view/Microsoft_Azure_CostManagement/Menu/~/costanalysis) |
| Manually trigger deploy | GitHub repo → Actions → Deploy → Run workflow |
