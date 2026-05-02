# PART 5: ENVIRONMENT VARIABLES CHECKLIST

Complete this template and save to `.env.local` in your project root.

---

## ═══════════════════════════════════════════════════════════════════════════════
## SUPABASE CONFIGURATION (REQUIRED)
## ═══════════════════════════════════════════════════════════════════════════════

### NEXT_PUBLIC_SUPABASE_URL
Description: Your Supabase project URL (public, safe in browser)
Required: YES - All authentication and database operations will fail without this
Where to get it:
  1. Go to https://supabase.com → Sign in to your project
  2. Click "Settings" → "API" in left sidebar
  3. Copy "Project URL"
  4. Format: https://[project-id].supabase.co

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

---

### NEXT_PUBLIC_SUPABASE_ANON_KEY
Description: Supabase anonymous key for browser (public, safe in browser)
Required: YES - Browser cannot authenticate to Supabase without this
Where to get it:
  1. Same location as above: Settings → API
  2. Copy "anon public" key
  3. This is the key that enforces RLS policies

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

---

### NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
Description: (OPTIONAL) Supabase service role key (KEEP SECRET, server-only)
Required: NO - Only needed if you need to bypass RLS in server code
Where to get it:
  1. Same location as anon key but marked "service_role secret"
  2. WARNING: This bypasses RLS - NEVER expose to browser or client
  3. Store ONLY in server environment variables

NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

---

## ═══════════════════════════════════════════════════════════════════════════════
## AI & GEMINI CONFIGURATION
## ═══════════════════════════════════════════════════════════════════════════════

### NEXT_PUBLIC_GEMINI_API_KEY
Description: Google Gemini API key for client-side AI operations (embeddings)
Required: CONDITIONAL - If NOT set, collusion detection will not work
Features that need this:
  - Semantic collusion detection (embeddings for answer comparison)
  - AI writing detection (per-answer analysis)
Where to get it:
  1. Go to https://ai.google.dev/
  2. Click "Get API Key"
  3. Select or create a Google Cloud project
  4. Create new API key
  5. Copy the key
  6. Note: Free tier has rate limits (~1,500 requests/day)
  7. Quota: https://console.cloud.google.com/quotas

NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxx

---

### GEMINI_API_KEY
Description: Google Gemini API key for server-side grading (server-only)
Required: CONDITIONAL - If NOT set, auto-grading of subjective answers will fail gracefully
Features that need this:
  - Subjective answer grading (uses Gemini 2.5-flash)
  - Gemini API access from /api/grade-answers endpoint
Where to get it:
  1. Same as NEXT_PUBLIC_GEMINI_API_KEY (can be same key)
  2. Store in .env.local only (not exposed to browser)

GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxx

---

## ═══════════════════════════════════════════════════════════════════════════════
## EMAIL CONFIGURATION
## ═══════════════════════════════════════════════════════════════════════════════

### RESEND_API_KEY
Description: API key for Resend email service
Required: CONDITIONAL - If NOT set, email invites cannot be sent
Features that need this:
  - Sending exam invite emails to students
  - HTML email templates with join links
Where to get it:
  1. Go to https://resend.com/
  2. Sign up / Sign in
  3. Go to "Integrations" or "API" section
  4. Create new API key
  5. Copy the key (format: re_xxxxx...)
  6. Add to environment

Fallback: If not set, API returns success but emails won't send
Cost: Free tier includes 100 emails/day

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

---

### NEXT_PUBLIC_APP_URL
Description: Your application's public URL for generating invite links
Required: YES - Invite emails won't have valid join links without this
Features that need this:
  - Building join links in exam invites: `{NEXT_PUBLIC_APP_URL}/join/{TOKEN}`
  - Email templates reference this to create clickable links
Where to get it:
  1. Local development: http://localhost:3000
  2. Staging: https://staging.yourdomain.com
  3. Production: https://yourdomain.com
  4. Does NOT include trailing slash

NEXT_PUBLIC_APP_URL=http://localhost:3000

---

## ═══════════════════════════════════════════════════════════════════════════════
## VIDEO CONFERENCING (OPTIONAL)
## ═══════════════════════════════════════════════════════════════════════════════

### DAILY_API_KEY
Description: API key for Daily.co video room management (optional feature)
Required: NO - Exams can function without this; it's for live video proctoring
Features that need this:
  - Creating live video rooms for synchronous proctoring
  - Managing participant limits and expiry
  - Video call integration (future feature)
Where to get it:
  1. Go to https://daily.co/
  2. Sign up / Sign in to console
  3. Go to Developers → API
  4. Copy API key
Fallback: If not set, createDailyRoom() returns null and feature is disabled
Cost: Pricing varies by usage; check Daily.co website

DAILY_API_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

---

## ═══════════════════════════════════════════════════════════════════════════════
## FEATURE FLAGS (OPTIONAL)
## ═══════════════════════════════════════════════════════════════════════════════

### NEXT_PUBLIC_ENABLE_VIDEO_ROOMS
Description: Enable/disable Daily.co video room creation
Required: NO - Default is false if not set
Values: "true" or "false" (as string, since it's in .env)
Impact: If false, Daily.co integration is skipped even if API key is present

NEXT_PUBLIC_ENABLE_VIDEO_ROOMS=false

---

### NEXT_PUBLIC_ENABLE_AI_DETECTION
Description: Enable/disable AI writing detection feature
Required: NO - Default is true
Values: "true" or "false"
Impact: If false, AI detection is skipped (saves API quota)
Depends on: NEXT_PUBLIC_GEMINI_API_KEY

NEXT_PUBLIC_ENABLE_AI_DETECTION=true

---

### NEXT_PUBLIC_ENABLE_COLLUSION_CHECK
Description: Enable/disable semantic collusion detection
Required: NO - Default is true
Values: "true" or "false"
Impact: If false, collusion check button hidden from UI
Depends on: NEXT_PUBLIC_GEMINI_API_KEY

NEXT_PUBLIC_ENABLE_COLLUSION_CHECK=true

---

### NEXT_PUBLIC_ENABLE_VERBOSE_LOGGING
Description: Enable detailed console logs for debugging
Required: NO - Default is false
Values: "true" or "false"
Impact: If true, many console.log statements fire during exam
Use when: Troubleshooting issues locally

NEXT_PUBLIC_ENABLE_VERBOSE_LOGGING=false

---

## ═══════════════════════════════════════════════════════════════════════════════
## DEPLOYMENT-SPECIFIC (OPTIONAL)
## ═══════════════════════════════════════════════════════════════════════════════

### NODE_ENV
Description: Deployment environment
Required: NO - Next.js detects this automatically
Values: "development", "production", "test"
Impact: Affects build optimization and error reporting

NODE_ENV=development

---

### NEXT_PUBLIC_API_URL
Description: (Optional) Custom API base URL for backend calls
Required: NO - Defaults to relative URLs (same origin)
Use when: Frontend and backend on different domains
Example: https://api.yourdomain.com

NEXT_PUBLIC_API_URL=http://localhost:3000

---

## ═══════════════════════════════════════════════════════════════════════════════
## COMPLETE TEMPLATE FOR .env.local
## ═══════════════════════════════════════════════════════════════════════════════

Copy the template below to `.env.local`:

```
# ─────────────────────────────────────────────────────────────
# SUPABASE (REQUIRED)
# ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ─────────────────────────────────────────────────────────────
# AI & GEMINI (CONDITIONAL - for grading and collusion detection)
# ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxx

# ─────────────────────────────────────────────────────────────
# EMAIL (CONDITIONAL - for sending exam invites)
# ─────────────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ─────────────────────────────────────────────────────────────
# VIDEO (OPTIONAL - for Daily.co rooms)
# ─────────────────────────────────────────────────────────────
DAILY_API_KEY=

# ─────────────────────────────────────────────────────────────
# FEATURE FLAGS (OPTIONAL)
# ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_ENABLE_VIDEO_ROOMS=false
NEXT_PUBLIC_ENABLE_AI_DETECTION=true
NEXT_PUBLIC_ENABLE_COLLUSION_CHECK=true
NEXT_PUBLIC_ENABLE_VERBOSE_LOGGING=false
```

---

## ═══════════════════════════════════════════════════════════════════════════════
## CONFIGURATION VALIDATION CHECKLIST
## ═══════════════════════════════════════════════════════════════════════════════

### Before Starting Development
- [ ] All REQUIRED variables set (marked "YES" above)
- [ ] NEXT_PUBLIC_APP_URL matches your actual deployment URL
- [ ] No trailing slashes on Supabase URL
- [ ] API keys are valid (not expired or revoked)
- [ ] Supabase project is active (can login at supabase.com)

### Before Running Development Server
- [ ] `.env.local` file exists in project root (next to package.json)
- [ ] File permissions allow reading (not chmod 000)
- [ ] No .env.local committed to git (check .gitignore)
- [ ] Run `npm run dev` and check: no "Missing env var" errors

### Before Deploying to Production
- [ ] Set all environment variables in Vercel/hosting dashboard
- [ ] Use PRODUCTION API keys (not development/testing keys)
- [ ] NEXT_PUBLIC_SUPABASE_URL points to production Supabase project
- [ ] RESEND_API_KEY is for production account (not sandbox)
- [ ] DAILY_API_KEY is for production account (if used)
- [ ] NEXT_PUBLIC_APP_URL is set to production domain
- [ ] Test email sends successfully on staging
- [ ] Test authentication works with production Supabase

### Troubleshooting

**"Missing environment variable"**
- Check .env.local exists
- Restart development server (`Ctrl+C`, then `npm run dev`)
- Verify variable name exactly matches (case-sensitive)

**"Unauthorized" errors on API calls**
- Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Verify Supabase Auth is enabled in project
- Check RLS policies allow reading from tables

**Emails not sending**
- Check RESEND_API_KEY is valid
- Check NEXT_PUBLIC_APP_URL is correct (determines join link)
- Verify Resend API key in Supabase/Vercel is same as .env.local
- Check email passed to Resend is in correct format (xxx@yyy.zzz)

**Gemini errors**
- Check API key format (should start with "AIzaSy")
- Verify API key is for "Gemini API", not other Google APIs
- Check Google Cloud project has billing enabled
- Check quota at https://console.cloud.google.com/quotas

---

## Environment Variable Reference by Feature

| Feature | Variables Needed | Optional? |
|---------|------------------|-----------|
| Authentication | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | NO |
| Exam Taking | (Auth only) | NO |
| Subjective Grading | GEMINI_API_KEY | YES - fallback to keyword matching |
| AI Detection | NEXT_PUBLIC_GEMINI_API_KEY | YES - skipped if not set |
| Collusion Detection | NEXT_PUBLIC_GEMINI_API_KEY | YES - skipped if not set |
| Email Invites | RESEND_API_KEY, NEXT_PUBLIC_APP_URL | YES - no emails sent |
| Video Rooms | DAILY_API_KEY | YES - feature disabled |

---

**Ready to deploy?** Run: `npm run build && npm start`
