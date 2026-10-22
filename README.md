# TradeFlow — B2B Distribution & Sales Portal (frontend prototype)

> **From Customer Request to Fulfillment.**
> A React + TypeScript prototype for stakeholder demonstration. All data is mock data and every action is simulated in the browser. It does **not** create SAP customers, submit SAP sales orders, verify payments or send email.

## Setup and run

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check (tsc -b) + production build to dist/
npm run preview    # serve the production build
npm run lint       # oxlint
npm test           # unit tests (Vitest): workflow engine, authorization, public projection, tracking
npm run build:html # one self-contained file: dist-single/index.html
```

End-to-end scenarios (Python Playwright, against a running build):

```bash
npm run build && npm run preview &        # http://localhost:4173
python3 tests/e2e/scenarios.py            # 18 scenarios + 5 edge cases
python3 tests/e2e/smoke.py                # every demo account × every permitted page, console errors
```

`build:html` inlines all code, styles and the logo into a single HTML file that opens by double-clicking (no server). It uses hash URLs (`#/app/...`) so routing works from disk; fonts load from Google Fonts when online, otherwise system fonts are used.

Open `/` for the public landing page, `/login` to sign in, `/register` to submit a Distributor Application, or `/track` to follow an application without signing in.

Demo state is mirrored to `localStorage` so a demo survives a refresh. **Reset demo data** is on the sign-in page (and in the profile menu for administrators).

> Access control and the distributor-onboarding workflow are documented in **[docs/ACCESS_CONTROL_AND_WORKFLOW.md](docs/ACCESS_CONTROL_AND_WORKFLOW.md)**, including everything that still needs a backend.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router 7 · Lucide React · Recharts · React Hook Form + Zod (small local resolver in `components/forms/zodResolver.ts`). No backend, no Next.js.

## Project structure

```
src/
  app/            router.tsx (lazy routes + permission guards), store.tsx (demo state, session, simulated actions with permission re-checks)
  auth/           permissions.ts (permission catalog), roles.ts (default roles), authorize.ts (central checks), guards.tsx (RequireAuth/RequirePermission/Can/403), demoCredentials.ts (PROTOTYPE ONLY)
  workflow/       onboarding.ts (configurable stages), engine.ts (pure transition rules), publicView.ts (applicant-safe projection), tracking.ts (mock public tracking)
  config/         brand.ts (product name/tagline — change here), navigation.ts (permission-driven sidebar + landing)
  components/
    layout/       AppShell, Sidebar, Topbar (search, notifications, help, profile/sign-out), PageHeader, Logo
    applications/ DistributorApplicationForm (register / draft / correction), PublicStatusCard
    ui/           Button, Badge/StatusBadge/DemoTag, Card, Dialog/ConfirmDialog/Drawer, Toast, Tabs, Popover menu, misc
    data-display/ DataTable (sort, paging, mobile cards), StatCard, Timeline, ApprovalChain, ProductVisual, FilterBar…
    forms/        Field controls, FileDrop (local-only), zodResolver
  pages/          public · dashboard · workspace · applications · customers (Distributors) · catalog · orders · approvals · finance · logistics · communications · administration
  data/           typed seed data (org, catalog, customers, applications, transactions, communications, integration, config)
  services/       contracts.ts (service interfaces) + mock.ts (mock implementations) + index.ts (single switch point)
  hooks/          useScope (permission/assignment-based data scope + task generation), misc hooks
  types/          domain.ts — the full typed domain model
  utils/          formatting, FX (illustrative), promo calculation, time helpers
  styles/         design tokens (Tailwind @theme)
```

## Demo accounts and roles

Sign in at `/login`. Every seeded account uses the prototype password **`TradeFlow@2026`** (shown on the sign-in page; prototype only). Users can hold several roles; access is the union of the roles' permissions, limited by the user's assignments.

| Role (configurable) | Requirement category | Demo user(s) | Record scope |
|---|---|---|---|
| System Administrator | System Administrator | Elena Petrova | Administration; read access to all records; no workflow decisions |
| Distributor Applicant | Requester / Applicant | Huda, Neema, Tom, Dilshan, Rafael, Ali, Siti | Own applications only |
| Distributor | Requester (approved) | Omar Haddad, Jonas Becker | Own distributor account only |
| Sales Coordinator (Initial Reviewer) | Initial Reviewer | Priya Nair (ME & Africa), Hassan Javed (Europe & APAC) | Applications assigned by review region |
| Territory Manager (Departmental Approver) | Departmental Approver | Daniel, Faisal, Sofia, Ken, Amara | Assigned territories |
| Regional Manager | (order approvals) | Layla, Henrik, Mei Lin | Assigned region |
| General Manager (Final Approver) | Final Approver | Marcus Chen | Final-stage applications; all orders |
| Finance Officer | (finance; optional credit-check stage) | Aisha Siddiqui | Finance records |
| Logistics Coordinator | (fulfilment) | Carlos Mendes | Shipments |
| Read-only Auditor | Read-only / Audit | Nadia Rahim | Everything, read-only, incl. audit trail |

## Implemented screens

Public: landing page · sign-in (`/login`) · Distributor registration with account creation and save-draft · **Track Application** (`/track`, reference + registered email or secure time-limited link).
Workspace: permission-composed overview with personalised application widgets · My tasks · Notifications.
Distributor onboarding: My Applications (list, detail, correct & resubmit, answer clarification, secure link) · Distributor Applications work queue (requiring my action / in progress / returned / approved / rejected) · Application detail (stage track, action panel with confirmation dialogs, internal/public history, revisions with field diff, current and superseded documents).
Sales: Distributors (accounts) · Distributor profile · Product catalog · Sales order request wizard · Requests · Request detail (approve / reject / return to requester / return to previous approver) · Orders · Proforma invoices · Payments.
Fulfillment: Shipment tracking · Shipment detail · Collection readiness · Documents.
Communication: Email split view · Follow-ups.
Administration: Approval workbench · Users (multi-role, assignments, effective permissions, responsibilities) · Roles & permissions · Authorization matrix (editable, CSV export) · Territories & regions · Workflow rules (onboarding stages, approval bands, tester/sample rules, notifications) · Integration monitor · Audit trail (CSV export).

## Simulated features

- Distributor onboarding: register (creates an applicant account) → initial review → commercial approval → final approval, with approve, reject (mandatory reason), return to requester (selected sections re-opened), request clarification, return to previous approver (internal findings) and resubmit (new revision). Final approval creates the distributor account (mock) and converts the applicant to a Distributor user.
- Catalog → cart → wizard with live price/availability check through the mock service, case-pack and stock validation, draft saving, confirmation dialog and demo request reference.
- Approval routing by USD value band (default: <25k TM; 25–100k TM→RM; ≥100k TM→RM→GM), SLA indicators, approve / reject / return to requester / return to previous approver with mandatory comments, acting user and timestamp recorded (earlier decisions kept); revise-and-resubmit.
- Finance issues proforma (creates invoice, payment record, document) → distributor uploads receipt (**Receipt Uploaded**) → finance completes a checklist and marks **Verified** (or rejects).
- Shipment flow: Approved → Awaiting Payment → Payment Verified → Ready for Warehouse Preparation → Documents in Progress → Ready for Collection (collection reference generated) → Collected. Logistics advances the warehouse steps; payment steps follow Finance.
- In-app notifications addressed to specific users (assignee, applicant, the distributor's own users) or roles; tasks generated from workflow state.
- Email compose/reply adds messages to local state only (marked "Simulated — not sent").
- Integration monitor retries resolve via the mock service (timeouts recover, validation errors keep failing).
- Admin changes (users, roles, permission grants, onboarding stages, approval bands, promo rules, territories) apply immediately and are written to the audit trail.

## Tester & sample calculation — assumptions (illustrative, to be confirmed)

Implemented in `src/utils/promo.ts`, configurable in Administration › Workflow Rules:

1. Eligible units = units in categories *Eau de Parfum, Extrait de Parfum, Eau de Toilette* (body mists, home fragrance and gift sets excluded).
2. Calculated on the whole request, rounding down: testers = ⌊eligible ÷ 6⌋; samples = ⌊eligible ÷ 12⌋ × 4 (1.2 ml each).
3. Testers and samples are free of charge and shown separately from priced lines.

## Known limitations

- **Authentication, authorization, persistence, notifications and public tracking are simulated in the browser.** They demonstrate the intended behaviour but are not secure: anyone with browser dev-tools can read or change the local state. See `docs/ACCESS_CONTROL_AND_WORKFLOW.md` for what production needs.
- Demo passwords are checked against a non-cryptographic hash in localStorage; the shared demo password is displayed on purpose.
- Prices, stock, FX rates, credit limits, bank details and ERP references are fictional. Brands and distributors are invented.
- Uploaded files are never stored — only name and size; previews are placeholders.
- Single-browser state (localStorage); no multi-user concurrency.
- Charts labelled "Illustrative" use synthetic history. No i18n/RTL, no real email delivery, no tax logic.

## Future backend & SAP integration requirements

The UI talks to data through `src/services/contracts.ts`. Replace `mockServices` in `src/services/index.ts` with a real implementation backed by a separately developed BFF/integration layer. That layer would need to provide:

- **Identity & access:** SSO / identity provider, server-side sessions, and the permission + assignment model of `src/auth` enforced on every API call (details in `docs/ACCESS_CONTROL_AND_WORKFLOW.md`).
- **Distributor registration:** persist applications, revisions and documents (object storage with virus scanning), the onboarding workflow engine, public tracking endpoint, and Business Partner creation/maintenance in S/4HANA on final approval.
- **Catalogue, pricing & availability:** product master, customer-specific pricing conditions and ATP/stock per plant.
- **Sales order requests:** persistence, approval workflow engine (value bands, SLAs, delegation/escalation), audit trail, and sales order creation in S/4HANA after final approval.
- **Tester/sample policy:** confirmed rules, possibly as free-goods condition records.
- **Finance:** proforma generation (document templates), bank-reconciliation-backed payment verification, billing document references.
- **Logistics:** outbound delivery, picking/packing, shipping documents and goods-issue status.
- **Communication:** mail integration (send/receive, threading), notification delivery (email/in-app).
- **Integration operations:** queueing, retries, error handling and monitoring (feeding the Integration Monitor screen).

All SAP API selection, endpoints and credentials are deliberately out of scope for this prototype.
