# Google Cloud API Connection Status

## ✅ Credentials Configuration

- **Credentials File**: `/home/ettomar/.eyeear/google_credentials.json` ✓ Found
- **Project ID**: `absolute-garden-428804-e8` ✓ Valid
- **Service Account**: `eyeear-tts@absolute-garden-428804-e8.iam.gserviceaccount.com` ✓ Valid

## ⚠️ Issues Found

### 1. Text-to-Speech API - Billing Required

**Status**: ❌ **Billing not enabled**

**Error**: 
```
PERMISSION_DENIED: This API method requires billing to be enabled. 
Please enable billing on project #427391647272
```

**Fix Required**:
1. Go to: https://console.developers.google.com/billing/enable?project=427391647272
2. Enable billing for your Google Cloud project
3. Wait a few minutes for changes to propagate

**Note**: Google Cloud TTS has a free tier (0-1 million characters/month), but billing must be enabled even for free usage.

### 2. Cloud Storage API - Missing Permissions

**Status**: ❌ **Insufficient permissions**

**Error**:
```
Permission 'storage.buckets.get' denied on resource
```

**Bucket**: `eyeear-ettomarett-app-bucket`

**Fix Required**:
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=absolute-garden-428804-e8
2. Find your service account: `eyeear-tts@absolute-garden-428804-e8.iam.gserviceaccount.com`
3. Add the following roles:
   - **Storage Object Creator** (to upload files)
   - **Storage Object Viewer** (to download files)
   - **Storage Object Admin** (optional, for bucket operations)

**Alternative**: If the bucket doesn't exist, create it first:
1. Go to: https://console.cloud.google.com/storage/browser?project=absolute-garden-428804-e8
2. Create a new bucket named: `eyeear-ettomarett-app-bucket`
3. Grant the service account the permissions listed above

## 🔧 Quick Fix Commands

### Enable Billing
Visit: https://console.developers.google.com/billing/enable?project=427391647272

### Grant Storage Permissions
1. Open: https://console.cloud.google.com/iam-admin/iam?project=absolute-garden-428804-e8
2. Click on service account `eyeear-tts@...`
3. Click "Edit" → "Add Another Role"
4. Add: `Storage Object Creator`, `Storage Object Viewer`

## ✅ After Fixing

Run the test again:
```bash
cd eyeear-audiobook
node test-gcp-connection.js
```

Expected output:
```
✓ TTS API connection successful!
✓ Storage API connection successful!
✅ All API connections successful!
```

