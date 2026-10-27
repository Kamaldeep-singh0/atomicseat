# ==============================================================================
# Atomic Seat — Google Cloud Run PowerShell Deployment Script
# Tagline: "Every seat. Exactly once."
# ==============================================================================

param (
    [string]$ProjectId = $env:GCP_PROJECT_ID,
    [string]$Region = "us-central1",
    [string]$Repository = "atomic-seat-repo",
    [string]$Tag = "latest",
    [string]$MongoUri = $env:MONGODB_URI,
    [string]$RedisUrl = $env:REDIS_URL,
    [string]$JwtSecret = $env:JWT_SECRET
)

if (-not $ProjectId) {
    $ProjectId = (gcloud config get-value project 2>$null)
}

if (-not $ProjectId) {
    Write-Error "GCP Project ID not found. Specify via -ProjectId <id> or set GCP_PROJECT_ID env var."
    exit 1
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Deploying Atomic Seat to Google Cloud Run" -ForegroundColor Cyan
Write-Host "Project:    $ProjectId"
Write-Host "Region:     $Region"
Write-Host "Repository: $Repository"
Write-Host "Tag:        $Tag"
Write-Host "================================================================="

# 1. Enable APIs
Write-Host "[1/6] Enabling Cloud Run and Artifact Registry APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project=$ProjectId

# 2. Artifact Registry
Write-Host "[2/6] Ensuring Artifact Registry repository exists..." -ForegroundColor Yellow
gcloud artifacts repositories describe $Repository --location=$Region --project=$ProjectId 2>$null
if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create $Repository --repository-format=docker --location=$Region --description="Atomic Seat Docker Images" --project=$ProjectId
}

gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

$RegistryBase = "$Region-docker.pkg.dev/$ProjectId/$Repository"

# 3. Build & Push API
Write-Host "[3/6] Building and pushing API and Worker images..." -ForegroundColor Yellow
$ApiImage = "$RegistryBase/atomic-seat-api:$Tag"
docker build -t $ApiImage -f api/Dockerfile .
docker push $ApiImage

$WorkerImage = "$RegistryBase/atomic-seat-worker:$Tag"
docker build -t $WorkerImage -f worker/Dockerfile .
docker push $WorkerImage

# 4. Deploy API
Write-Host "[4/6] Deploying API to Cloud Run (Concurrency: 20, Max: 10, Min: 1, Timeout: 3600, Session Affinity: On)..." -ForegroundColor Yellow
gcloud run deploy atomic-seat-api `
    --image=$ApiImage `
    --platform=managed `
    --region=$Region `
    --project=$ProjectId `
    --port=4000 `
    --concurrency=20 `
    --max-instances=10 `
    --min-instances=1 `
    --timeout=3600 `
    --session-affinity `
    --allow-unauthenticated `
    --set-env-vars="NODE_ENV=production,MONGODB_URI=$MongoUri,REDIS_URL=$RedisUrl,JWT_SECRET=$JwtSecret,LOCK_STRATEGY=mongo-atomic,MAX_RUSH_USERS=300"

$ApiUrl = (gcloud run services describe atomic-seat-api --region=$Region --project=$ProjectId --format="value(status.url)")
Write-Host "API live at: $ApiUrl" -ForegroundColor Green

# 5. Deploy Rush Worker
Write-Host "[5/6] Deploying Rush Worker to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy atomic-seat-worker `
    --image=$WorkerImage `
    --platform=managed `
    --region=$Region `
    --project=$ProjectId `
    --port=5000 `
    --concurrency=80 `
    --max-instances=2 `
    --min-instances=0 `
    --timeout=300 `
    --allow-unauthenticated `
    --set-env-vars="NODE_ENV=production,TARGET_API_URL=$ApiUrl,MAX_RUSH_USERS=300,DEFAULT_DURATION_SECONDS=30"

$WorkerUrl = (gcloud run services describe atomic-seat-worker --region=$Region --project=$ProjectId --format="value(status.url)")
Write-Host "Worker live at: $WorkerUrl" -ForegroundColor Green

# Update API with WORKER_URL
gcloud run services update atomic-seat-api --region=$Region --project=$ProjectId --update-env-vars="WORKER_URL=$WorkerUrl" --quiet

# 6. Deploy Web
Write-Host "[6/6] Building and deploying Web frontend..." -ForegroundColor Yellow
$WebImage = "$RegistryBase/atomic-seat-web:$Tag"
docker build --build-arg NEXT_PUBLIC_API_URL=$ApiUrl --build-arg NEXT_PUBLIC_WS_URL=$ApiUrl -t $WebImage -f web/Dockerfile .
docker push $WebImage

gcloud run deploy atomic-seat-web `
    --image=$WebImage `
    --platform=managed `
    --region=$Region `
    --project=$ProjectId `
    --port=3000 `
    --concurrency=80 `
    --max-instances=5 `
    --min-instances=1 `
    --timeout=300 `
    --allow-unauthenticated `
    --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_API_URL=$ApiUrl,NEXT_PUBLIC_WS_URL=$ApiUrl"

$WebUrl = (gcloud run services describe atomic-seat-web --region=$Region --project=$ProjectId --format="value(status.url)")

Write-Host "=================================================================" -ForegroundColor Green
Write-Host "Atomic Seat Deployed Successfully!" -ForegroundColor Green
Write-Host "Web URL:    $WebUrl"
Write-Host "API URL:    $ApiUrl"
Write-Host "Worker URL: $WorkerUrl"
Write-Host "=================================================================" -ForegroundColor Green
