#!/bin/bash

# Configuration
PROJECT_ID="rekvin-v0"
IMAGE_NAME="rekvin-engine"
SERVICE_NAME="rekvin-persona-engine"
REGION="us-central1"
GCLOUD_PATH="/Users/aniket/google-cloud-sdk/bin/gcloud"

echo "🚀 Starting deployment to Google Cloud Run..."

# 1. Build and push image using Cloud Build
echo "🏗 Building and pushing Docker image to GCR..."
$GCLOUD_PATH builds submit --tag gcr.io/$PROJECT_ID/$IMAGE_NAME --project $PROJECT_ID

# 2. Deploy to Cloud Run
echo "🌍 Deploying to Cloud Run..."

if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ Error: GEMINI_API_KEY environment variable is not set."
  echo "Please set it before running: export GEMINI_API_KEY=your_key"
  exit 1
fi

$GCLOUD_PATH run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --session-affinity \
  --project $PROJECT_ID \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY,GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$REGION"

echo "✅ Deployment complete!"
