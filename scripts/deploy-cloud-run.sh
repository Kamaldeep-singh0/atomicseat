#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Atomic Seat — Google Cloud Run Production Deployment Script
# Tagline: "Every seat. Exactly once."
#
# IMPORTANT BILLING SAFETY NOTICE:
# Before running high-concurrency load tests against Google Cloud Run,
# configure a Cloud Billing Budget and Alert in GCP Console:
# https://console.cloud.google.com/billing/budgets
# Set an alert threshold (e.g., $10 or $25) to avoid surprise costs.
# ==============================================================================

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"
REPOSITORY="${GCP_REPOSITORY:-atomic-seat-repo}"
TAG="${IMAGE_TAG:-latest}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: GCP_PROJECT_ID environment variable is not set and no default gcloud project found."
  echo "Usage: GCP_PROJECT_ID=my-project-id ./scripts/deploy-cloud-run.sh"
  exit 1
fi

echo "================================================================="
echo "Deploying Atomic Seat to Google Cloud Run"
echo "Project:    ${PROJECT_ID}"
echo "Region:     ${REGION}"
echo "Repository: ${REPOSITORY}"
echo "Tag:        ${TAG}"
echo "================================================================="

# 1. Enable Required Google Cloud APIs
echo "[1/6] Enabling required GCP service APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Create Artifact Registry Repository if not exists
echo "[2/6] Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe "${REPOSITORY}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Creating Docker repository '${REPOSITORY}' in ${REGION}..."
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Atomic Seat Docker Images" \
    --project="${PROJECT_ID}"
fi

# Authenticate Docker with Artifact Registry
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

REGISTRY_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"

# 3. Build & Push Docker Images
echo "[3/6] Building and pushing Docker container images..."

# Build & Push API
API_IMAGE="${REGISTRY_BASE}/atomic-seat-api:${TAG}"
echo "Building API image: ${API_IMAGE}..."
docker build -t "${API_IMAGE}" -f api/Dockerfile .
docker push "${API_IMAGE}"

# Build & Push Rush Worker
WORKER_IMAGE="${REGISTRY_BASE}/atomic-seat-worker:${TAG}"
echo "Building Worker image: ${WORKER_IMAGE}..."
docker build -t "${WORKER_IMAGE}" -f worker/Dockerfile .
docker push "${WORKER_IMAGE}"

# 4. Deploy API to Cloud Run with required autoscaling parameters
# - Concurrency: 20 (forces extra instances during rush)
# - Max instances: 10
# - Min instances: 1
# - Timeout: 3600
# - Session affinity: on
echo "[4/6] Deploying API Service to Cloud Run..."
gcloud run deploy atomic-seat-api \
  --image="${API_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=4000 \
  --concurrency=20 \
  --max-instances=10 \
  --min-instances=1 \
  --timeout=3600 \
  --session-affinity \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,MONGODB_URI=${MONGODB_URI:-},REDIS_URL=${REDIS_URL:-},JWT_SECRET=${JWT_SECRET:-atomic_seat_jwt_prod},LOCK_STRATEGY=${LOCK_STRATEGY:-mongo-atomic},MAX_RUSH_USERS=300"

API_URL="$(gcloud run services describe atomic-seat-api --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"
echo "API deployed successfully at: ${API_URL}"

# 5. Deploy Rush Worker to Cloud Run
echo "[5/6] Deploying Rush Worker Service to Cloud Run..."
gcloud run deploy atomic-seat-worker \
  --image="${WORKER_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=5000 \
  --concurrency=80 \
  --max-instances=2 \
  --min-instances=0 \
  --timeout=300 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,TARGET_API_URL=${API_URL},MAX_RUSH_USERS=300,DEFAULT_DURATION_SECONDS=30"

WORKER_URL="$(gcloud run services describe atomic-seat-worker --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"
echo "Rush Worker deployed successfully at: ${WORKER_URL}"

# Update API with WORKER_URL for proxy routing
gcloud run services update atomic-seat-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --update-env-vars="WORKER_URL=${WORKER_URL}" \
  --quiet

# 6. Build & Deploy Web Frontend with Cloud Run API URL
echo "[6/6] Building and deploying Web Frontend..."
WEB_IMAGE="${REGISTRY_BASE}/atomic-seat-web:${TAG}"
docker build \
  --build-arg NEXT_PUBLIC_API_URL="${API_URL}" \
  --build-arg NEXT_PUBLIC_WS_URL="${API_URL}" \
  -t "${WEB_IMAGE}" \
  -f web/Dockerfile .
docker push "${WEB_IMAGE}"

gcloud run deploy atomic-seat-web \
  --image="${WEB_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --port=3000 \
  --concurrency=80 \
  --max-instances=5 \
  --min-instances=1 \
  --timeout=300 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_API_URL=${API_URL},NEXT_PUBLIC_WS_URL=${API_URL}"

WEB_URL="$(gcloud run services describe atomic-seat-web --region="${REGION}" --project="${PROJECT_ID}" --format='value(status.url)')"

echo "================================================================="
echo "Atomic Seat successfully deployed to Google Cloud Run!"
echo "Web UI:      ${WEB_URL}"
echo "API Service: ${API_URL}"
echo "Rush Worker: ${WORKER_URL}"
echo "================================================================="
