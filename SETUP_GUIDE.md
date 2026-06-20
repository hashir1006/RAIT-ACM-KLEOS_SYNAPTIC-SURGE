# GST Mitra AI - Secure Migration Guide

## PHASE 15: COMPLETE SETUP & DEPLOYMENT GUIDE

This guide provides step-by-step instructions to deploy the fully migrated, enterprise-secure GST Mitra AI application.

---

## TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Migration](#database-migration)
5. [Encryption Setup](#encryption-setup)
6. [Backend Deployment](#backend-deployment)
7. [Frontend Migration](#frontend-migration)
8. [Security Hardening](#security-hardening)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Security Audit Checklist](#security-audit-checklist)

---

## Prerequisites

### Required Software
- Node.js 18+ LTS
- npm 9+ or yarn
- Git
- PostgreSQL client tools (optional, for direct DB access)
- Postman or similar API testing tool (optional)

### Required Accounts
- Supabase account (https://supabase.com) - FREE tier available
- Google Cloud Project with Gemini API enabled
- GitHub account (for version control)

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Supabase Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Configure:
   - **Name**: `gst-mitra-ai`
   - **Database Password**: Generate strong password (save securely)
   - **Region**: Choose closest to your users (India: Singapore)
   - **Pricing**: Free tier (can upgrade later)
4. Wait for project initialization (5-10 minutes)

### Step 2: Get Connection Details

1. Go to Project Settings → API
2. Copy and save:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY` (KEEP SECRET!)

### Step 3: Enable Authentication Methods

1. Go to Authentication → Providers
2. Email/Password: Already enabled ✅
3. (Optional) Enable:
   - Google OAuth
   - GitHub OAuth
4. Set redirect URL to your frontend domain

### Step 4: Create Storage Buckets

1. Go to Storage → Buckets
2. Create two buckets:
   - Name: `invoice-files` | Private | Encryption: OFF (files are encrypted before upload)
   - Name: `tax-documents` | Private | Encryption: OFF

---

## Environment Configuration

### Step 1: Create .env File

```bash
cd /path/to/RAIT-ACM-KLEOS_SYNAPTIC-SURGE-main
cp .env.example .env
```

### Step 2: Fill Environment Variables

```bash
# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # 🔒 KEEP SECRET!

# ENCRYPTION
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_SECRET=generate_your_base64_secret_here

# JWT AUTHENTICATION
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=generate_your_hex_secret_here

# GEMINI API
GEMINI_API_KEY=your_gemini_api_key_here

# APPLICATION
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
```

### Step 3: Generate Secrets

```bash
# Generate ENCRYPTION_SECRET (base64, 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Output example: d9KFm5n+z7/Q2w8kL3X9pM=

# Generate JWT_SECRET (hex, 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output example: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 4: Security - Do NOT Commit .env

```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore

# Verify
git check-ignore .env  # Should return: .env
```

---

## Database Migration

### Step 1: Run SQL Migrations

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire contents of `migrations/001_initial_schema.sql`
4. Paste into SQL Editor
5. Click "RUN"
6. Wait for completion (should show 0 errors)

**Verify tables were created:**

```sql
-- Run this query to verify
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Expected tables:
-- ✅ user_profiles
-- ✅ tax_records
-- ✅ suppliers
-- ✅ invoices
-- ✅ tax_documents
-- ✅ gstr2b_records
-- ✅ reconciliation_results
-- ✅ audit_logs
-- ✅ notifications
-- ✅ sessions
```

### Step 2: Verify Row Level Security (RLS)

```sql
-- Check RLS is enabled on all tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND EXISTS(
  SELECT 1 FROM pg_policies 
  WHERE pg_policies.tablename = pg_tables.tablename
)
ORDER BY tablename;
```

All tables should have RLS policies.

### Step 3: Test Supabase Connection

```bash
npm run dev

# Visit http://localhost:3000/api/health
# Expected response:
# { "status": "ok", "time": "2026-06-19T...", "environment": "development" }
```

---

## Encryption Setup

### Step 1: Verify Encryption Key

```bash
# Check ENCRYPTION_SECRET is loaded
node -e "
const dotenv = require('dotenv');
dotenv.config();
const secret = process.env.ENCRYPTION_SECRET;
console.log('✅ ENCRYPTION_SECRET loaded:', secret ? 'YES (hidden)' : '❌ NOT SET');
console.log('   Length:', secret?.length, 'bytes');
"
```

### Step 2: Test Encryption/Decryption

```bash
# Create test file: test-encryption.js
cat > test-encryption.js << 'EOF'
const { encrypt, decrypt } = require('./src/utils/encryption.ts');

// Test encrypt
const plaintext = 'Sample GSTIN: 27BBBBB2222B2Z2';
const encrypted = encrypt(plaintext);
console.log('Plaintext:', plaintext);
console.log('Ciphertext:', encrypted.ciphertext.substring(0, 20) + '...');
console.log('IV:', encrypted.iv.substring(0, 20) + '...');

// Test decrypt
const decrypted = decrypt(encrypted.ciphertext, encrypted.iv);
console.log('Decrypted:', decrypted);
console.log('Match:', decrypted === plaintext ? '✅ YES' : '❌ NO');
EOF

# Run test
npx ts-node test-encryption.js

# Cleanup
rm test-encryption.js
```

---

## Backend Deployment

### Step 1: Install Dependencies

```bash
npm install

# Verify all packages installed
npm list | grep -E "(bcryptjs|jsonwebtoken|@supabase/supabase-js|cors|helmet)"
```

### Step 2: Start Development Server

```bash
npm run dev

# Expected output:
# ✅ GST Mitra AI Server ready on port 3000
# 📍 Environment: development
# 🔐 Encryption: AES-256-GCM
# 🎫 Authentication: JWT
# 🗄️  Database: Supabase PostgreSQL + RLS
```

### Step 3: Test API Endpoints

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test registration endpoint
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "businessName": "Test Business",
    "ownerName": "Test Owner",
    "gstin": "27BBBBB2222B2Z2",
    "mobileNumber": "9876543210"
  }'

# Expected response:
# {
#   "success": true,
#   "data": {
#     "user": {...},
#     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
#   }
# }
```

### Step 4: Test Authentication

```bash
# Save token from registration response
TOKEN="your_jwt_token_here"

# Test protected endpoint
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "id": "user-uuid-here",
#     "email": "test@example.com",
#     ...
#   }
# }
```

---

## Frontend Migration

### Step 1: Update App.tsx

Replace localStorage calls with new API client:

```typescript
// OLD (REMOVE):
const [profile, setProfile] = useState(() => {
  const saved = localStorage.getItem('gst_mitra_profile');
  if (saved) return JSON.parse(saved);
  return defaultProfile;
});

// NEW (ADD):
import { useAuth, useInvoices } from './api/client';

export default function App() {
  const { user, isAuthenticated, loading } = useAuth();
  const { invoices, fetchInvoices, addInvoice } = useInvoices();

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvoices();
    }
  }, [isAuthenticated, fetchInvoices]);

  // ... rest of component
}
```

### Step 2: Remove localStorage Persistence

Delete these useEffect hooks from App.tsx:

```typescript
// DELETE all instances of:
useEffect(() => {
  localStorage.setItem('gst_mitra_profile', JSON.stringify(profile));
}, [profile]);

// And similar for other state variables
```

### Step 3: Update Upload Component

```typescript
// OLD: Upload to localStorage
// NEW: Upload encrypted to Supabase Storage via API

import { apiCall } from './api/client';

async function handleFileUpload(file: File, invoiceId: string) {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result as string;
    const mimeType = file.type;
    
    // Call backend to encrypt and store
    const response = await apiCall('/upload/invoice', {
      method: 'POST',
      body: {
        fileName: file.name,
        fileData: base64.split(',')[1],
        mimeType,
        invoiceId
      }
    });
    
    console.log('File encrypted and stored:', response.data.filePath);
  };
  reader.readAsDataURL(file);
}
```

### Step 4: Update Chat Component

```typescript
// OLD: Direct fetch to /api/chat
// NEW: Uses JWT authentication via API client

import { sendChatMessage } from './api/client';

const handleSend = async (message: string) => {
  try {
    const response = await sendChatMessage(message, messages, {
      profile: user,
      invoices
    });
    
    // Display response
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: 'bot',
      message: response.text,
      timestamp: new Date().toLocaleTimeString()
    }]);
  } catch (error) {
    console.error('Chat failed:', error);
  }
};
```

---

## Security Hardening

### Step 1: Enable HTTPS in Production

**For development**: Already using HTTP on localhost
**For production**: 
- Deploy on HTTPS-only domain
- Use Let's Encrypt (free SSL) or Cloudflare
- Update NEXT_PUBLIC_APP_URL to HTTPS URL

### Step 2: Implement Rate Limiting

Already configured in server.ts:
- 100 requests per 15 minutes (general)
- 5 auth attempts per 15 minutes (login/register)
- 50 file uploads per hour

### Step 3: Configure CORS

Update allowed origins in server.ts:

```typescript
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
app.use(cors({
  origin: CORS_ORIGIN,  // Set to your production domain
  credentials: true
}));
```

### Step 4: Enable Security Headers

Already configured via Helmet middleware:
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Frame-Options (frameguard)
- X-Content-Type-Options (noSniff)
- X-XSS-Protection

### Step 5: Implement File Size Limits

Already configured:
- Max JSON payload: 25MB
- Max file upload: 10MB
- Max PDF size: 10MB
- Allowed file types: PDF, JPG, JPEG, PNG

### Step 6: Database Access Control

✅ Row Level Security (RLS) policies:
- Users can only see their own data
- Service role can create audit logs
- Storage buckets private (user-specific paths)

---

## Testing

### Unit Tests for Encryption

```bash
cat > test-encryption-full.ts << 'EOF'
import { encrypt, decrypt, encryptObject, decryptObject } from './src/utils/encryption';

// Test 1: String encryption
const plaintext = 'Sensitive Data';
const encrypted = encrypt(plaintext);
const decrypted = decrypt(encrypted.ciphertext, encrypted.iv);
console.assert(decrypted === plaintext, '❌ String encryption failed');
console.log('✅ String encryption passed');

// Test 2: Object encryption
const obj = { gstin: '27BBBBB2222B2Z2', amount: 100000 };
const encObj = encryptObject(obj);
const decObj = decryptObject(encObj.ciphertext, encObj.iv);
console.assert(JSON.stringify(decObj) === JSON.stringify(obj), '❌ Object encryption failed');
console.log('✅ Object encryption passed');

// Test 3: Unique IVs
const enc1 = encrypt('Test');
const enc2 = encrypt('Test');
console.assert(enc1.iv !== enc2.iv, '❌ IVs should be different');
console.log('✅ Unique IV generation passed');
EOF

npx ts-node test-encryption-full.ts
rm test-encryption-full.ts
```

### API Integration Tests

```bash
# Test 1: Health Check
curl -s http://localhost:3000/api/health | jq .

# Test 2: Register User
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@gmail.com",
    "password": "TestPass123!",
    "businessName": "Test Co",
    "ownerName": "Test Owner",
    "gstin": "27XXXXX1111X1Z1",
    "mobileNumber": "9999999999"
  }')

echo $REGISTER_RESPONSE | jq .

# Extract token
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
echo "Token: $TOKEN"

# Test 3: Get Profile (Authenticated)
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test 4: Create Invoice
curl -s -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "INV-2026-001",
    "invoice_date": "2026-06-19",
    "supplier_name": "Test Supplier",
    "supplier_gstin": "27YYYYY2222Y2Z2",
    "buyer_gstin": "27XXXXX1111X1Z1",
    "hsn_code": "8517",
    "taxable_amount": 100000,
    "cgst": 9000,
    "sgst": 9000,
    "igst": 0,
    "total_gst": 18000,
    "grand_total": 118000
  }' | jq .

# Test 5: Get Invoices
curl -s http://localhost:3000/api/invoices \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Frontend Testing

```bash
# Build production bundle
npm run build

# Check build output
ls -lh dist/

# Test production build locally
npm run start
# Visit http://localhost:3000
```

---

## Troubleshooting

### Issue: "SUPABASE_SERVICE_ROLE_KEY not configured"

**Cause**: Environment variable not set or server can't read it

**Solution**:
```bash
# Check .env file exists and has the key
cat .env | grep SUPABASE_SERVICE_ROLE_KEY

# Restart server
npm run dev
```

### Issue: "Invalid or expired token"

**Cause**: JWT signature mismatch or expiration

**Solution**:
```bash
# Verify JWT_SECRET matches in server
cat .env | grep JWT_SECRET

# Tokens expire in 7 days - login again
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Issue: "Encryption failed: Invalid key size"

**Cause**: ENCRYPTION_SECRET is wrong size (not 32 bytes)

**Solution**:
```bash
# Generate correct secret (base64, 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Update .env and restart
npm run dev
```

### Issue: "RLS policy violation"

**Cause**: User trying to access another user's data

**Solution**:
```bash
# Check RLS policies are correctly set
SELECT * FROM pg_policies WHERE tablename = 'invoices';

# Users should only access their own data via:
Authorization: Bearer <their_jwt_token>
```

### Issue: "CORS error: Origin not allowed"

**Cause**: Frontend origin not whitelisted

**Solution**:
```typescript
// In server.ts
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
app.use(cors({ origin: CORS_ORIGIN }));

// Make sure NEXT_PUBLIC_APP_URL matches your domain
```

### Issue: "Too many requests" (Rate limit)

**Cause**: Exceeded rate limits (100/15min general, 5/15min auth)

**Solution**:
```bash
# Wait 15 minutes or adjust limits in server.ts
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100  // Increase if needed
});
```

---

## Security Audit Checklist

### Authentication ✅
- [x] JWT tokens with 7-day expiration
- [x] bcrypt password hashing (12 rounds)
- [x] Password strength validation
- [x] Rate limiting on auth endpoints
- [x] No passwords stored in plaintext
- [x] HTTPS required in production

### Encryption ✅
- [x] AES-256-GCM for sensitive data
- [x] Unique IV for every encryption operation
- [x] Encryption keys stored in .env (not in code)
- [x] File encryption before upload
- [x] Encrypted files in Supabase Storage

### Database ✅
- [x] Row Level Security (RLS) on all tables
- [x] Users can only access their own records
- [x] Service role key never exposed to frontend
- [x] Audit logs for all actions
- [x] Timestamps on all records

### API Security ✅
- [x] Input validation on all endpoints
- [x] CORS with origin whitelist
- [x] Security headers via Helmet
- [x] Rate limiting
- [x] No sensitive data in logs
- [x] Error messages don't leak information

### File Handling ✅
- [x] File type validation (PDF, JPG, PNG only)
- [x] File size limits (10MB max)
- [x] Files encrypted before storage
- [x] Files stored in private bucket
- [x] Original files never exposed

### Frontend ✅
- [x] localStorage removed
- [x] JWT stored in sessionStorage only
- [x] No hardcoded secrets
- [x] Content Security Policy enabled
- [x] XSS protection via helmet

### Infrastructure ✅
- [x] Environment variables for all secrets
- [x] .env in .gitignore (not in version control)
- [x] Supabase HTTPS endpoints
- [x] HTTPS enforced in production
- [x] Audit logs enabled
- [x] Database backups enabled (Supabase auto-backup)

---

## Production Deployment Checklist

### Before Going Live

1. **Change Secrets**
   ```bash
   # Generate new ENCRYPTION_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # Generate new JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Add to production .env (NOT in git)
   ```

2. **Update Environment**
   ```bash
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=https://yourdomain.com  # HTTPS!
   NEXT_PUBLIC_API_URL=https://yourdomain.com/api  # HTTPS!
   ```

3. **Build Production Bundle**
   ```bash
   npm run build
   npm run start
   ```

4. **Test Production Build**
   - Run full test suite
   - Test on actual domain (not localhost)
   - Test with real HTTPS certificate
   - Test all payment/transaction flows

5. **Security Tests**
   ```bash
   # SSL/TLS check
   curl -I https://yourdomain.com
   
   # Security headers check
   curl -I https://yourdomain.com | grep -E "Strict-Transport-Security|Content-Security-Policy"
   
   # CORS test
   curl -H "Origin: https://other.com" https://yourdomain.com/api/health
   # Should reject request
   ```

6. **Enable Monitoring**
   - Set up application logging
   - Monitor error rates
   - Set up alerts for:
     - High encryption failures
     - RLS policy violations
     - Unusual login patterns
     - File upload anomalies

7. **Database Backups**
   - Supabase auto-backup: ✅ Enabled
   - Backup frequency: Daily
   - Retention: 7 days (free tier)
   - Test restore procedure

8. **Documentation**
   - Document all API endpoints
   - Create admin runbook
   - Document incident response procedures
   - Create user guide for GST Mitra features

---

## Support & Updates

### Staying Secure

- [ ] Keep dependencies updated: `npm update`
- [ ] Review security advisories: `npm audit`
- [ ] Monitor Supabase announcements
- [ ] Update RLS policies if schema changes
- [ ] Review audit logs monthly

### Ongoing Maintenance

- [ ] Monitor API error rates
- [ ] Review slow queries (Supabase logs)
- [ ] Backup and restore test quarterly
- [ ] Security audit semi-annually
- [ ] Update encryption secrets annually

---

## Next Steps

1. ✅ Complete all steps above
2. ✅ Run security audit checklist
3. ✅ Perform load testing (if high traffic expected)
4. ✅ Set up monitoring and alerts
5. ✅ Document your deployment procedures
6. ✅ Train team on secure practices
7. ✅ Go live!

---

**Version**: 1.0 | **Last Updated**: 2026-06-19 | **Status**: Production Ready ✅
