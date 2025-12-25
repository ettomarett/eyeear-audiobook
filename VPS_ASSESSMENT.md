# VPS Assessment for EyeEar Deployment (Docker)

## Current VPS Setup

### Infrastructure
- **OS**: Ubuntu (Linux vmi2731864 6.8.0-86-generic)
- **Traefik**: Running in Docker (traefik:v2.11.27)
  - Config location: `/root/services/clueleak-traefik/`
  - Static config: `traefik.yml`
  - Dynamic config: `dynamic.yml` (watched for changes)
  - SSL: Cloudflare DNS challenge (certResolver: cf)
  - EntryPoints: web (80), websecure (443), metrics (9101), traefik (8080)
  - **Uses Docker labels** for service discovery (not file-based config)

### Drone CI
- **Server**: `ci.clueleak.com` (drone-server container)
- **Protocol**: HTTPS
- **Status**: Already configured and running

### Existing Services
- CMS (Ghost) - `cms.clueleak.com` (Docker)
- Uptime Kuma - `uptime.clueleak.com` (Docker)
- Grafana Monitor - `monitor.clueleak.com` (Docker)
- Frontend - `clueleak.com` (Docker)
- SI-Releves (backend/frontend containers) - Uses Docker labels for Traefik

### Deployment Pattern
All services follow this pattern:
- Located in `/root/services/{service-name}/`
- Use `docker-compose.yml` with Traefik labels
- Connected to `traefik` network
- Traefik auto-discovers services via Docker labels

### What Needs to Be Added for EyeEar
1. **Deployment directory** - `/root/ettomarett/apps/eyeear-audiobook/` (will be created automatically by Drone CI)
2. **Docker image** - Will be built by Drone CI
3. **docker-compose.yml** - Already created with Traefik labels
4. **No Traefik file config needed** - Uses Docker labels (auto-discovery)

## What Needs to Be Added

### 1. Deploy docker-compose.yml
The `docker-compose.yml` file will be deployed by Drone CI. It includes:
- Traefik labels for auto-discovery
- Volume mounts for persistent data
- Network connection to `traefik` network

**No manual Traefik configuration needed!** Traefik will automatically discover the service via Docker labels.

### 3. Update Drone CI Configuration
The `.drone.yml` is already configured to:
- Build Docker image
- Deploy to `/root/services/eyeear-audiobook/`
- Use `docker-compose` to start the service

**Drone CI Secrets needed** (set at `ci.clueleak.com`):
- `ssh_key`: SSH private key for VPS access
- `deploy_host`: `84.247.166.77` (or `eyeear.clueleak.com`)
- `deploy_user`: `root`
- `deploy_path`: `/root/ettomarett/apps/eyeear-audiobook`

**Note**: The deployment directory will be created automatically by Drone CI - no manual setup needed!

## Deployment Steps (Safe - Won't Break Existing Setup)

### Step 1: Configure Drone CI Secrets
In Drone CI at `ci.clueleak.com`, add secrets for your repository:
- `ssh_key`: Your SSH private key (base64 encoded or raw)
- `deploy_host`: `84.247.166.77`
- `deploy_user`: `root`
- `deploy_path`: `/root/services/eyeear-audiobook`

### Step 2: Deploy via Drone CI
Push to the repository and Drone CI will automatically:
1. Build the React frontend
2. Build the Docker image
3. Deploy `docker-compose.yml` to the server
4. Build Docker image on server
5. Start the container with `docker-compose up -d`
6. Traefik will auto-discover the service via Docker labels

**No manual Traefik configuration needed!** The Docker labels in `docker-compose.yml` handle everything.

## Verification

After deployment, verify:
```bash
# Check container status
docker ps | grep eyeear

# Check logs
docker logs eyeear-backend
docker logs -f eyeear-backend  # Follow logs

# Test health endpoint (inside container)
docker exec eyeear-backend curl http://localhost:3003/api/health

# Test via Traefik (after DNS is configured)
curl https://eyeear.clueleak.com/api/health

# Check Traefik discovered the service
# (Traefik dashboard or logs should show the new router)
```

## DNS Configuration

Make sure `eyeear.clueleak.com` DNS A record points to `84.247.166.77`.

## Notes

- All changes are **additive only** - nothing is removed or modified
- **No Traefik file configuration needed** - Uses Docker labels (auto-discovery)
- **Directory created automatically** - Drone CI creates `/root/ettomarett/apps/eyeear-audiobook/` on first deployment
- Docker container is isolated (doesn't conflict with existing services)
- Uses existing `traefik` network (already configured)
- Persistent data stored in Docker volumes (survives container restarts)

