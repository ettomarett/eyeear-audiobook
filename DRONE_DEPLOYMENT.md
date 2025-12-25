# Drone CI Deployment Guide for EyeEar Audiobook

This guide explains how to set up automated deployment to `eyeear.clueleak.com` using Drone CI.

## Prerequisites

1. **Drone CI Server** - Running and accessible
2. **SSH Access** - SSH key with access to `eyeear.clueleak.com`
3. **Server Requirements**:
   - Node.js 20+ installed
   - Traefik installed and configured
   - Systemd available for service management
   - SSL certificates configured in Traefik (Let's Encrypt recommended)

## Setup Steps

### 1. Configure Drone CI Secrets

In your Drone CI interface, add the following secrets for the repository:

```bash
# SSH private key (base64 encoded)
drone secret add --repository <owner>/<repo> --name ssh_key --data @~/.ssh/id_rsa

# Deployment host
drone secret add --repository <owner>/<repo> --name deploy_host --data eyeear.clueleak.com

# Deployment user
drone secret add --repository <owner>/<repo> --name deploy_user --data <your-username>

# Deployment path
drone secret add --repository <owner>/<repo> --name deploy_path --data /root/ettomarett/apps/eyeear-audiobook
```

Or via Drone CLI:
```bash
drone secret add \
  --repository <owner>/<repo> \
  --name ssh_key \
  --data "$(cat ~/.ssh/id_rsa | base64)"

drone secret add \
  --repository <owner>/<repo> \
  --name deploy_host \
  --data eyeear.clueleak.com

drone secret add \
  --repository <owner>/<repo> \
  --name deploy_user \
  --data <your-username>

drone secret add \
  --repository <owner>/<repo> \
  --name deploy_path \
  --data /var/www/eyeear
```

### 2. Server Setup

On `eyeear.clueleak.com`, prepare the deployment directory:

```bash
# Create deployment directory
sudo mkdir -p /var/www/eyeear/{frontend,backend,data,logs,output,temp}
sudo chown -R $USER:$USER /var/www/eyeear

# Note: The backend will serve the frontend static files
# Frontend files are deployed to /var/www/eyeear/frontend
# Backend creates a symlink to serve them

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Traefik should already be installed and running
# Verify Traefik is running
sudo systemctl status traefik
# Or if using Docker:
# docker ps | grep traefik
```

### 3. No Manual Setup Needed!

The deployment directory and all necessary structure will be created automatically by Drone CI on the first deployment.

### 4. Configure Traefik (Not Needed!)

Ensure Traefik is configured to use file provider for dynamic configuration:

```bash
# Create dynamic configuration directory (if it doesn't exist)
sudo mkdir -p /etc/traefik/dynamic

# Copy Traefik configuration
sudo cp traefik.yml /etc/traefik/dynamic/eyeear.yml

# Ensure Traefik static config includes file provider
# Add to your main Traefik config (usually /etc/traefik/traefik.yml):
# See traefik-static.yml.example for reference

# Reload Traefik
sudo systemctl reload traefik
# Or if using Docker:
# docker restart traefik
```

### 5. SSL Certificate (Automatic via Traefik)

Traefik handles SSL certificates automatically via Let's Encrypt. Ensure your Traefik configuration includes:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /etc/traefik/acme.json
      httpChallenge:
        entryPoint: web
```

Traefik will automatically obtain and renew certificates for `eyeear.clueleak.com`.

### 6. Environment Variables (Optional)

Create a `.env` file on the server (if needed):

```bash
cd /var/www/eyeear/backend
nano .env
```

Add any required environment variables:
```
NODE_ENV=production
PORT=3003
GCS_BUCKET_NAME=your-bucket-name
```

### 7. First Deployment

After setting up secrets, push to the `main` or `master` branch:

```bash
git add .drone.yml
git commit -m "Add Drone CI deployment configuration"
git push origin main
```

Drone CI will automatically:
1. Install dependencies
2. Build the React frontend
3. Test the backend
4. Deploy to the server
5. Set up systemd service
6. Run health checks

## Deployment Process

The `.drone.yml` pipeline includes:

1. **install-dependencies** - Installs npm packages
2. **build-frontend** - Builds React app with Vite
3. **test-backend** - Tests backend health endpoint
4. **build-docker-image** - Builds Docker image (for testing)
5. **deploy-to-server** - Creates directory, builds Docker image on server, deploys with docker-compose
6. **health-check** - Verifies deployment success
7. **notify-deployment** - Prints deployment notification

## Manual Deployment

If you need to deploy manually:

```bash
# Build frontend
npm run build:react

# Create directory on server
ssh root@84.247.166.77 "mkdir -p /root/ettomarett/apps/eyeear-audiobook"

# Transfer files
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' \
  . root@84.247.166.77:/root/ettomarett/apps/eyeear-audiobook/build/
rsync -avz --delete dist/ root@84.247.166.77:/root/ettomarett/apps/eyeear-audiobook/build/dist/
rsync -avz docker-compose.yml root@84.247.166.77:/root/ettomarett/apps/eyeear-audiobook/

# On server, build and start
ssh root@84.247.166.77
cd /root/ettomarett/apps/eyeear-audiobook
cd build && docker build -t eyeear-audiobook:latest .
cd .. && docker-compose up -d
```

## Troubleshooting

### Backend not starting

```bash
# Check container status
docker ps | grep eyeear
docker ps -a | grep eyeear  # Include stopped containers

# Check logs
docker logs eyeear-backend
docker logs -f eyeear-backend  # Follow logs

# Check if container is running
docker exec eyeear-backend ps aux
```

### Traefik errors

```bash
# Check Traefik status
sudo systemctl status traefik
# Or if using Docker:
# docker logs traefik

# Check Traefik configuration
sudo traefik version
# Or if using Docker:
# docker exec traefik traefik version

# View Traefik logs
sudo journalctl -u traefik -f
# Or if using Docker:
# docker logs -f traefik
```

### Port conflicts

If port 3003 is in use (unlikely with Docker):

```bash
# Check if another container is using the port
docker ps | grep 3003

# Or check host port binding
netstat -tlnp | grep 3003
```

### Permission issues

```bash
# Check container permissions
docker exec eyeear-backend ls -la /app

# Check volume permissions
docker volume inspect eyeear-audiobook_eyeear_data
```

## Monitoring

After deployment, monitor:

- **Backend health**: `https://eyeear.clueleak.com/api/health`
- **Container status**: `docker ps | grep eyeear`
- **Logs**: `docker logs eyeear-backend` or `docker logs -f eyeear-backend`
- **Docker Compose status**: `cd /root/ettomarett/apps/eyeear-audiobook && docker-compose ps`
- **Traefik dashboard**: `https://traefik.yourdomain.com` (if enabled)
- **Traefik logs**: `sudo journalctl -u traefik -f` or `docker logs -f traefik`

## Rollback

To rollback to a previous version:

```bash
# SSH to server
ssh root@84.247.166.77

# Go to deployment directory
cd /root/ettomarett/apps/eyeear-audiobook

# Rebuild with previous code (or use git to checkout previous version)
cd build
git checkout <previous-commit-hash>  # If using git
docker build -t eyeear-audiobook:latest .

# Restart container
cd ..
docker-compose restart
# Or rebuild and restart
docker-compose up -d --force-recreate
```

## Security Notes

- Keep SSH keys secure and rotate regularly
- Use strong SSL/TLS configuration
- Keep Node.js and dependencies updated
- Monitor logs for suspicious activity
- Use firewall rules to restrict access if needed

