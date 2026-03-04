#!/usr/bin/env bash
# Create and configure an Azure Application Insights resource.
# Adapted from microsoft/GitHub-Copilot-for-Azure (MIT licensed).
#
# Required environment variables:
#   RESOURCE_GROUP           - Azure resource group name
#   APP_INSIGHTS_NAME        - Name for the App Insights resource
#   LOG_ANALYTICS_WORKSPACE  - Name for the Log Analytics workspace
#   AZURE_REGION             - Azure region (e.g., eastus)
#   CONTAINER_APP_NAME       - Azure Container App name (for env var setup)

set -euo pipefail

# Add the Application Insights extension
az extension add -n application-insights

# Create a Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WORKSPACE" \
  --location "$AZURE_REGION"

# Create the Application Insights resource
az monitor app-insights component create \
  --app "$APP_INSIGHTS_NAME" \
  --location "$AZURE_REGION" \
  --resource-group "$RESOURCE_GROUP" \
  --workspace "$LOG_ANALYTICS_WORKSPACE"

# Query connection string
CONNECTION_STRING=$(az monitor app-insights component show \
  --app "$APP_INSIGHTS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString \
  --output tsv)

echo "Connection string: $CONNECTION_STRING"

# Set environment variable on Azure Container App
az containerapp update \
  -n "$CONTAINER_APP_NAME" \
  -g "$RESOURCE_GROUP" \
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=$CONNECTION_STRING"
