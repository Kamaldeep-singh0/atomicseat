# Atomic Seat — Google Cloud Run & GitHub Actions Deployment Guide

> **Every seat. Exactly once.**

This guide details deploying Atomic Seat to **Google Cloud Run** using keyless **Workload Identity Federation (WIF)** in **GitHub Actions**, along with configuring managed MongoDB Atlas and Upstash Redis.

---

## ⚠️ Critical Safety Requirement: Set a Cloud Billing Alert

High-concurrency load tests (e.g. 300 virtual buyers generating thousands of requests) will cause Cloud Run to rapidly scale out container instances. Before running load tests:

1. Open the [Google Cloud Billing Console](https://console.cloud.google.com/billing).
2. Go to **Budgets & Alerts** -> **Create Budget**.
3. Name: `Atomic-Seat-Load-Test-Budget`.
4. Target: Set a modest budget (e.g. **\$10.00 USD** or **\$25.00 USD**).
5. Trigger alerts at **50%**, **90%**, and **100%** of budget via email notification.

---

## Step 1: Managed Database & Cache Setup

### 1. MongoDB Atlas (Free M0 Tier or Dedicated)
1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Under **Network Access**, add `0.0.0.0/0` (Allow access from anywhere, necessary because Cloud Run instances have dynamic outbound IPs).
3. Under **Database Access**, create a user (e.g., `atomic_admin`).
4. Copy the connection string URI:
   ```
   mongodb+srv://atomic_admin:<PASSWORD>@cluster0.abcde.mongodb.net/atomicseat?retryWrites=true&w=majority
   ```

### 2. Upstash Redis (Serverless Redis)
1. Create a free database at [console.upstash.com](https://console.upstash.com).
2. Under **Details**, copy the Node.js connection URL (TLS enabled `rediss://...`):
   ```
   rediss://default:<PASSWORD>@us1-active-panda-12345.upstash.io:6379
   ```

---

## Step 2: Configure Workload Identity Federation (WIF)

Workload Identity Federation allows GitHub Actions to authenticate directly with Google Cloud without storing long-lived, sensitive JSON service account keys in repository secrets.

Run the following commands in Google Cloud Shell or local terminal with `gcloud`:

```bash
# Variables
export PROJECT_ID="your-gcp-project-id"
export GITHUB_REPO="your-github-username/atomicseat" # Format: USER/REPO
export POOL_NAME="github-pool"
export PROVIDER_NAME="github-provider"
export SERVICE_ACCOUNT_NAME="atomic-seat-deployer"

# 1. Enable required APIs
gcloud services enable \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Create a Workload Identity Pool
gcloud iam workload-identity-pools create "${POOL_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 3. Create a Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_NAME}" \
  --display-name="GitHub OIDC Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 4. Create Service Account for deployment
gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="Atomic Seat GitHub Actions Deployer"

# 5. Grant required IAM roles to Service Account
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 6. Bind GitHub Repository to the Service Account
export POOL_ID=$(gcloud iam workload-identity-pools describe "${POOL_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding \
  "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${GITHUB_REPO}"

# 7. Print Provider Resource Name for GitHub Secret
echo "=== GitHub Secret: GCP_WORKLOAD_IDENTITY_PROVIDER ==="
echo "${POOL_ID}/providers/${PROVIDER_NAME}"

echo "=== GitHub Secret: GCP_SERVICE_ACCOUNT ==="
echo "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
```

---

## Step 3: Configure GitHub Repository Secrets

In your GitHub repository, navigate to **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `GCP_PROJECT_ID` | Your Google Cloud project ID | `my-gcp-project-12345` |
| `GCP_REGION` | Target Cloud Run deployment region | `us-central1` |
| `GCP_REPOSITORY` | Artifact Registry Docker repository name | `atomic-seat-repo` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full resource name of the WIF provider | `projects/123.../locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | Deployer Service Account email | `atomic-seat-deployer@my-project.iam.gserviceaccount.com` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `REDIS_URL` | Upstash Redis connection string | `rediss://default:...` |
| `JWT_SECRET` | Secret key for signing auth tokens | Any 32+ character random string |
| `LOCK_STRATEGY` | Default locking strategy | `mongo-atomic` |

---

## Step 4: Triggering Deployment

Pushing any commit to `main` automatically triggers the `.github/workflows/deploy.yml` pipeline:
1. Runs the test suite and 500-request concurrency benchmark.
2. Authenticates to GCP via Workload Identity Federation (zero JSON keys).
3. Builds and pushes multi-stage container images to Artifact Registry.
4. Deploys:
   - **`atomic-seat-api`**: Concurrency: 20, Max instances: 10, Min instances: 1, Timeout: 3600s, Session Affinity: On.
   - **`atomic-seat-worker`**: Concurrency: 80, Max instances: 2, Min instances: 0.
   - **`atomic-seat-web`**: Concurrency: 80, Max instances: 5, Min instances: 1.

You can also trigger manual deployments via GitHub's **Actions** tab -> **Deploy to Google Cloud Run** -> **Run workflow**.
