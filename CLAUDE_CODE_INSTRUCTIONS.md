# PURECODE CRM — Build Instructions for Claude Code

## WHAT THIS IS
You are building a **cold-calling CRM dashboard** for PureCode Agency. It has two roles:

1. **Admin (David)** — sees everything: all leads, all agents, all stats, all call recordings, JustCall phone number health. Can reassign leads, bulk-import, pull reports.

2. **Agent (Khalid/Omar/Sara)** — sees only their assigned leads, their own stats, their 3 rotating phone numbers, and a "wins only" team feed (demos + closes only). Cannot see other agents' data, admin reports, or billing.

## THE STACK
- **Frontend**: React + Vite + Tailwind (or raw CSS matching the existing dark theme)
- **Backend**: Node.js + Express (already scaffolded in `/server`)
- **Auth**: JWT with bcrypt passwords (already scaffolded in `/server/middleware/auth.js`)
- **Database**: GoHighLevel (GHL) via REST API — contacts are leads, notes are call logs
- **Calling**: JustCall API — click-to-call, recordings, number rotation
- **Deployment**: Vercel (frontend + serverless functions)

## CRITICAL RULES

### White-labeling
- **NEVER show "GoHighLevel", "GHL", "JustCall", or any third-party tool name** in the frontend UI, error messages, console logs visible to users, or any user-facing text.
- All error messages must be generic: "Something went wrong — contact David" not "GHL API returned 429"
- The app brand is **PureCode** everywhere. Logo, title, favicon, emails.

### Security (RBAC)
- **Every API endpoint checks the JWT role server-side.** Frontend hiding is cosmetic only.
- Agent requesting `/api/stats/team` → 403 Forbidden
- Agent requesting leads not assigned to them → 403 Forbidden
- Admin can access everything
- Never trust the frontend — always verify on the backend

### Design
- Dark theme: background `#07080b`, cards `#0e0f14`, borders `rgba(255,255,255,0.06)`
- Primary color: `#00e5a0` (green)
- Accent colors: orange `#ff6b35`, blue `#4ea8de`, purple `#a78bfa`, gold `#f5c842`
- Fonts: `Syne` for headings (800 weight), `DM Sans` for body, `DM Mono` for data/numbers
- Reference the UI playbook file (`purecode_ui_playbook.html`) for exact visual targets

## FILE STRUCTURE (already created)
```
purecode-crm/
├── server/
│   ├── index.js                 ← Express entry point
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js              ← JWT verify + requireAuth + requireAdmin
│   ├── routes/
│   │   ├── auth.js              ← Login, /me, /agents list
│   │   ├── leads.js             ← CRUD leads, notes, call trigger, assign
│   │   ├── stats.js             ← Agent + team stats
│   │   ├── feed.js              ← Activity feed (wins-only for agents)
│   │   ├── webhooks.js          ← JustCall call-end webhook
│   │   └── justcall.js          ← Number health, call logs
│   └── services/
│       ├── ghl.js               ← ALL GHL API calls (the only file that knows GHL exists)
│       └── justcall.js          ← ALL JustCall API calls
├── client/
│   └── src/
│       ├── components/          ← Reusable UI components
│       ├── pages/               ← Route pages (Dashboard, Queue, Leads, etc)
│       ├── styles/              ← CSS / theme variables
│       └── utils/               ← API client, auth helpers
├── docs/
│   └── purecode_ui_playbook.html ← Visual specification
├── .env.example                 ← Required environment variables
├── .gitignore
└── package.json
```

## BUILD SEQUENCE

### Day 1: Backend + GHL wiring
1. `cd server && npm install`
2. Copy `.env.example` to `.env`, fill in GHL API key + location ID
3. Start server: `npm run dev`
4. Test: `curl http://localhost:3001/api/health` should return `{ status: ok }`
5. Fix the GHL service (`services/ghl.js`):
   - The `mapContactToLead()` function needs real custom field IDs
   - Go to GHL → Settings → Custom Fields → create: `business_type`, `tier`, `owner_name`, `google_score`, `hook_note`, `warning`
   - Copy each field's ID and update the mapping
6. Test: `curl http://localhost:3001/api/leads` (will need auth first)

### Day 2: Auth system
1. Hash real passwords for each agent using bcrypt
2. Update the USERS array in `routes/auth.js` with real hashes
3. Test login: `curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"david","password":"purecode2026"}'`
4. Test RBAC: use agent token to call admin endpoint → should get 403

### Day 3: React frontend shell
1. `cd client && npm create vite@latest . -- --template react`
2. Install: `npm install react-router-dom axios`
3. Set up routing:
   - `/login` → Login page
   - `/dashboard` → Admin dashboard OR agent dashboard (based on role)
   - `/leads` → All leads (admin) or My Queue (agent)
   - `/agents` → Admin only
   - `/assign` → Admin only
   - `/my-numbers` → Agent phone rotation
   - `/activity` → Activity feed
4. Create auth context: store JWT in httpOnly cookie or localStorage
5. Create `api.js` utility that adds Bearer token to every request
6. Build the login screen matching the playbook design
7. Build the app shell (topbar + sidebar) with role-based menu

### Day 4: Agent queue + click-to-call
This is the most important screen. Reference Section 04 of the playbook.
1. "My Queue" page — fetch `/api/leads?assigned=me`, display as table
2. "Next Call" hero card — big green pulsing button with lead info + hook
3. Phone rotation bar — show 3 numbers with call counters
4. Click call button → POST `/api/leads/:id/call` → triggers JustCall
5. In-call overlay — timer, script tabs, outcome buttons, quick note
6. After outcome selected → POST note → auto-advance to next lead

### Day 5: Admin dashboard
Reference Section 03 of the playbook.
1. KPI strip — calls today, interested, demos, pipeline value
2. Agent leaderboard with LIVE indicator
3. Activity feed — full (not wins-only)
4. Pipeline status bars
5. JustCall health panel
6. All Leads table with filters + assign button

### Day 6: Webhooks + real-time
1. Set up JustCall webhook URL: `https://your-vercel-url/api/webhooks/justcall`
2. Configure in JustCall dashboard → Webhooks → call.completed event
3. Verify webhook signature
4. Activity feed: poll `/api/feed` every 10 seconds

### Day 7: Deploy
1. `vercel` CLI to deploy
2. Set env vars in Vercel dashboard
3. Point `app.purecodeagency.com` CNAME to Vercel
4. Create real agent accounts, import 50 leads, test end-to-end

## API ENDPOINTS SUMMARY
| Method | Path | Role | What it does |
|--------|------|------|--------------|
| POST | /api/auth/login | Public | Login → returns JWT |
| GET | /api/auth/me | Both | Verify token, get user info |
| GET | /api/auth/agents | Admin | List all agents |
| GET | /api/leads | Both | Get leads (filtered by role) |
| GET | /api/leads/:id | Both | Single lead + notes |
| POST | /api/leads/:id/note | Both | Log call outcome + note |
| POST | /api/leads/:id/call | Both | Trigger JustCall click-to-call |
| PUT | /api/leads/:id/assign | Admin | Reassign lead |
| POST | /api/leads/bulk-assign | Admin | Bulk assign unassigned leads |
| GET | /api/stats/me | Both | Agent's own stats |
| GET | /api/stats/team | Admin | All agents stats |
| GET | /api/feed | Both | Activity feed (auto-filtered by role) |
| POST | /api/webhooks/justcall | Webhook | JustCall call-end handler |
| GET | /api/justcall/health | Admin | Phone number status |
| GET | /api/justcall/calls | Both | Call logs |

## GHL CUSTOM FIELDS TO CREATE
Before the backend works, create these custom fields in GHL:
1. `business_type` (dropdown: Roofing, Towing, HVAC, Plumbing, Auto Repair, Car Care)
2. `tier` (dropdown: 1, 2, 3)
3. `owner_name` (text)
4. `google_score` (text)
5. `hook_note` (text area — David's custom hooks for each lead)
6. `warning` (text — license revoked, wrong area code, etc)
7. `last_outcome` (dropdown: New, Called, No Answer, Interested, Demo Booked, Closed, Not Qualified)

## WHEN STUCK
- GHL API docs: https://highlevel.stoplight.io/
- JustCall API docs: https://developer.justcall.io/
- If an API call fails, check the server console — errors are logged with `[GHL ERROR]` or `[JUSTCALL ERROR]` prefixes
- Never expose these error details to the frontend
