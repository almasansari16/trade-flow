# Access control, distributor onboarding workflow and public tracking

This document describes what the TradeFlow **frontend prototype** implements and what a backend must still provide. Everything below marked *prototype* runs in the browser against mock data in `localStorage`. **None of it is a security boundary.**

---

## 1. Frontend vs. backend at a glance

| Capability | Implemented in this frontend | Still requires backend work |
|---|---|---|
| Sign-in | Login form (validation, show/hide, generic error, 5-attempt lockout, session expiry 8 h, sign-out, return-to-page) against a **mock credential store** | Identity provider (OIDC/SAML), salted slow hashing (Argon2id/bcrypt), MFA, password reset, HttpOnly secure session cookies, server-side lockout and session revocation |
| Roles & permissions | Permission catalog, configurable roles, multi-role users, editable matrix, protected critical grants | `roles`, `permissions`, `role_permissions`, `user_roles` tables; admin APIs with their own authorization; change approval if required |
| Route & action gating | Menu, routes (typed URLs → 403 or sign-in), buttons and store actions all check the same permissions | **Every API endpoint must check permission + record scope server-side.** Browser checks only shape the UI |
| Record scope | Ownership, territory/region and review-region assignments, stage assignment | Same rules as query filters in the API/DB (row-level security), never trusting IDs from the client |
| Onboarding workflow | Configurable stages, pure transition engine, mandatory remarks, return routing, revisions, append-only history | Workflow service executing the same rules transactionally, with optimistic locking and idempotency |
| Public tracking | Ref + email or ref + token, generic errors, throttling, applicant-safe projection | Server endpoint returning only the projection, hashed single-purpose tokens, rate limiting per IP/reference, email delivery of links, logging |
| Notifications | In-app notifications targeted to users/roles; preference screen | Email/push delivery, templates, retries, unsubscribe, delivery logs |
| Audit trail | Consolidated, append-only *in the UI*, CSV export | Immutable server-side audit store (see §7) |
| Documents | Name/size/type, revision and supersession metadata | Object storage, malware scanning, access-controlled download URLs, retention |

---

## 2. Permission model

Catalog: `src/auth/permissions.ts` (id, module, action, label, description, critical flag). Ids follow `module.action[_scope]`, for example:

| Group | Examples |
|---|---|
| Workspace | `dashboard.view`, `task.view`, `notification.view` |
| Distributor applications | `application.create`, `application.view_own`, `application.edit_own`, `application.resubmit`, `application.view_assigned`, `application.view_all`, `application.view_internal`, `application.review`, `application.approve`, `application.reject`, `application.return_to_requester`, `application.request_clarification`, `application.return_to_previous_approver` |
| Distributors | `distributor.view_own`, `distributor.view_assigned`, `distributor.view_all`, `distributor.manage` |
| Sales orders | `order.view_own/assigned/all`, `order.create`, `order.create_on_behalf`, `order.approve`, `order.reject`, `order.return_to_requester`, `order.return_to_previous_approver`, … |
| Administration (critical ★) | `user.view★`, `user.manage★`, `role.view★`, `role.manage★`, `permission.manage★`, `workflow.manage`, `territory.manage`, `audit.view`, … |

**Effective permissions** = union of the permissions of the user's roles (`src/auth/authorize.ts → permissionsFor`). Inactive users have none.

**Record scope** is decided by permissions *plus* assignments — never by a role name:

| Record | Rule (prototype: `authorize.ts`, `store.tsx`, `useScope.ts`) |
|---|---|
| Distributor application | owner with `view_own`; or `view_all`; or `view_assigned` **and** (currently assigned to the user, or the user acted/was addressed in its history, or it waits in a role queue of the user's role). Drafts are visible only to their owner. |
| Distributor account & its orders/invoices/shipments | `view_all`; or `view_assigned` within the user's territories/region; or `view_own` for the user's linked account |
| Sales-order approval | pending step's role held by user + any order decision permission + (step approver, or territory/region assignment) |

### Default roles (configurable)

| Requirement category | Built-in role | Notes |
|---|---|---|
| System Administrator | `admin` | Manages users, roles, permissions, workflow, territories, integrations. Has read access to records but **no** application decision permissions (segregation of duties). Critical permissions cannot be revoked from this role, the last active admin cannot be removed/deactivated, users cannot deactivate themselves. |
| Requester / Distributor Applicant | `applicant`, `distributor` | Applicant becomes `distributor` automatically on final approval. |
| Initial Reviewer | `sales_coordinator` | Review, return, clarification; **no reject by default** (decision left to approvers — grant `application.reject` to change). |
| Departmental Approver | `territory_manager` | Assigned by territory. |
| Final Approver | `general_manager` | Role queue. |
| Read-only / Audit | `auditor` | View-all + internal remarks + audit trail; no modify permissions. |
| (other) | `regional_manager`, `finance`, `logistics` | Finance can act on the optional *Credit & compliance check* stage. |

Custom roles can be created (empty or copied) in **Administration › Roles & Permissions**.

---

## 3. Data model (maps to the requested tables)

| Requested table | Prototype type / location |
|---|---|
| `users` | `DemoUser` (`src/types/domain.ts`), seed `src/data/org.ts` |
| `roles` | `Role`, seed `src/auth/roles.ts`, runtime `state.roles` |
| `permissions` | `PermissionDef`, `src/auth/permissions.ts` (static catalog) |
| `user_roles` | `DemoUser.roleIds` |
| `role_permissions` | `Role.permissions` |
| `user_assignments` | `DemoUser.territoryIds`, `regionId`, `reviewRegionIds`, `customerId`, `department` |
| `workflow_stages` | `WorkflowDef` / `WorkflowStageDef`, `src/workflow/onboarding.ts`, runtime `state.onboardingWorkflow` |
| `application_workflow_history` | `RegistrationApplication.history: WorkflowEvent[]` (append-only) |
| (supporting) | `ApplicationRevision` snapshots, `ApplicationDocument` with `revision` / `supersededInRevision`, `AdminAuditEntry`, `Session`, `DemoCredential` |

Suggested production schema additions: `applications(id, ref, status, current_stage_id, assigned_user_id, revision, owner_user_id, version)`, `application_revisions(application_id, revision, content_json, submitted_at)`, `application_documents(id, application_id, storage_key, type, revision, superseded_in_revision, sha256)`, `tracking_tokens(application_id, token_hash, expires_at, revoked_at)`, `audit_log(...)` (see §7).

---

## 4. Workflow

### Statuses

`Draft → Submitted → Under Review → (Pending Approval)* → Approved` with side paths `Returned for Correction → Resubmitted`, and terminal `Rejected`.

### Default stages (`src/workflow/onboarding.ts`, editable in **Workflow Rules › Distributor onboarding**)

| # | Stage | Type | Role | Assignment | SLA |
|---|---|---|---|---|---|
| 1 | Initial review | review | Sales Coordinator | by review region | 48 h |
| – | Credit & compliance check | approval | Finance Officer | role queue | 48 h (inactive by default) |
| 2 | Commercial approval | approval | Territory Manager | territory manager of the applicant's territory | 48 h |
| 3 | Final approval | approval | General Manager | role queue | 72 h |

Policies: resubmission goes to the *returning stage and reviewer* (or the first stage); returns to *any* earlier stage (or only the immediately previous one). Saving is refused if an active stage's role lacks the needed permission or has no active members, or if a stage with in-flight applications would be deactivated.

### Transitions (`src/workflow/engine.ts`)

| Action | Who | Required input | Result |
|---|---|---|---|
| Start review | stage owner, `review`/`approve` | – | Submitted/Resubmitted → Under Review / Pending Approval; assigned to actor |
| Approve / Recommend & forward | stage owner, `application.review` (review stage) or `application.approve` | optional internal + public remarks | next active stage (assignee resolved, notified) or **Approved** at the last stage → distributor account created (mock), applicant role → Distributor |
| Reject | `application.reject` | **public reason ≥ 10 chars** | Rejected (terminal, distinct from a return) |
| Return to requester | `application.return_to_requester` | **instructions ≥ 10 chars + ≥ 1 section** | Returned for Correction; only selected sections editable |
| Request clarification | `application.request_clarification` | **question ≥ 10 chars** | Returned for Correction (no fields re-opened) |
| Return to previous approver | `application.return_to_previous_approver` | **internal findings ≥ 10 chars**, target stage | moves to that stage, assigned to the approver who last approved there (if still active) else the stage's assignee; internal event + public "assigned" event |
| Resubmit / answer | owner, `application.resubmit` | correction: changed content; clarification: answer | Resubmitted; correction increments the revision and snapshots content; routed per policy |

The same `availableActions` function renders the buttons **and** re-validates inside `applyReviewerAction` before any state change. Every transition appends `WorkflowEvent`s (actor, time, from/to status and stage, recipient, public and internal remarks, visibility, revision). Events are never edited or removed; superseded documents are kept.

Sales-order requests gained **Return to previous approver** (earlier decisions are archived in `ApprovalStep.history`) and per-decision permissions with mandatory comments.

---

## 5. Public tracking (no sign-in)

`/track` accepts **reference + registered email**, or a **secure link** `/track?ref=…&token=…` (random 192-bit token, 30-day expiry, revocable/regenerable by the applicant). The reference alone shows nothing.

The response is the **applicant-safe projection** `toPublicView()` (`src/workflow/publicView.ts`): status, headline, current stage label and number, submission/last-update dates, required action and editable sections, public remarks, decision message, and a timeline of *public* events that actually happened. It never contains internal remarks, staff names, assignment details, other applications or document contents. Errors are identical for unknown reference, wrong email and wrong token; five failures trigger a 60-second cool-down (per browser session in the prototype).

**Backend required:** a dedicated endpoint (e.g. `POST /public/applications/track`) that performs the lookup server-side, compares email case-insensitively against verified addresses, stores only **hashes** of tracking tokens, rate-limits per IP and per reference with exponential back-off/CAPTCHA, logs every attempt, returns only the projection, sets `Cache-Control: no-store`, and emails the link instead of exposing it only on screen. Consider email one-time codes instead of long-lived links.

---

## 6. Notifications

Generated on: submitted, assigned / moved to next stage, approved (incl. final), rejected, returned to requester, clarification requested, returned to previous approver, resubmitted / clarification answered, account created. Each is addressed to specific users (assignee, applicant, previous approver, the distributor's own users) or, for role queues, to the role. Preferences per event are listed in **Workflow Rules › Notification preferences**.

**Backend required:** a notification service (outbox pattern from the workflow transaction), email templates, delivery retries and logs, user-level preferences, and suppression for inactive users.

---

## 7. Audit trail and immutable logging

The prototype shows a consolidated audit trail (application workflow history, sales-order activity, user/role/permission/workflow/territory changes, sign-in success/failure) with filters and CSV export. It has no edit/delete path, but browser storage is **not** tamper-proof.

Production requirements:

1. Write audit records server-side in the **same transaction** as the change (or via a transactional outbox).
2. Append-only store: no UPDATE/DELETE grants for the application user; WORM/object-lock storage or hash-chaining (`hash = sha256(prev_hash + record)`) with periodic anchoring.
3. Server-assigned timestamps from a trusted clock; actor taken from the authenticated session, never from the request body.
4. Record before/after values for configuration and permission changes; include request id, IP and user agent for security events.
5. Retention policy and restricted read access (`audit.view`), with exports themselves audited.

---

## 8. Server-side validation required in production

- Authenticate every request; derive the actor from the session.
- For every endpoint: check the permission **and** the record scope (ownership/assignment/territory) in the query, not after loading.
- Re-run the workflow rules (`availableActions` equivalent) inside a transaction with optimistic concurrency (`version` column) so two approvers cannot act on the same stage; make transitions idempotent.
- Validate all inputs (mandatory remarks, allowed sections, field formats) with the same schema as the UI.
- Enforce that applicants can change only the sections re-opened for correction; keep previous revisions immutable.
- Prevent privilege escalation: only `permission.manage` may change grants; protect critical grants and the last administrator; consider four-eyes approval for role changes.
- Never return internal remarks or other users' data to external users; use separate DTOs for public, applicant and reviewer views.
- Document uploads: type/size limits, malware scanning, storage outside the web root, short-lived signed download URLs.

---

## 9. Decisions taken where requirements conflicted (least-disruptive choices)

| Topic | Decision |
|---|---|
| "Customer" → "Distributor" | All user-facing text uses *Distributor* (navigation, pages, forms, filters, breadcrumbs, empty states, messages, URLs `/app/distributors`). Internal type and field names (`Customer`, `customerId`) are unchanged to avoid a risky refactor; old URLs redirect. Kept on purpose: the brand tagline "From Customer Request to Fulfillment" (branding) and the SAP object name "customer master / Business Partner" in integration texts. |
| Existing roles vs. requested roles | Existing roles kept and mapped to the requested categories (§2); new `applicant` and `auditor` roles added. Roles are data, so organisations can rename or add roles. |
| Demo role switcher | Removed (it bypassed authentication). Replaced by real sign-in with labelled demo accounts on the login page. |
| Reset demo data | Moved to the sign-in page and the admin profile menu. |
| Initial reviewer rejecting | Not granted by default (rejection is an approver decision); configurable in the matrix. |
| Administrator decisions | Admin can see but not decide applications (segregation of duties); grantable if desired. |
| `/status/:ref` public page | Replaced by `/track` because a reference alone must not reveal data; the old URL redirects to the verification form. |
| Registration | Now also creates the applicant account (email + password) so applicants can sign in, save drafts, correct and resubmit. |

---

## 10. Tests

- `npm test` — 16 Vitest unit tests on the engine (stage ownership, permission per action, start-before-decide, no previous approver at first stage, mandatory remarks, return-to-previous recipient, append-only history, resubmit routing variants, activated stage routing), record-level visibility, public projection leakage and the tracking service.
- `tests/e2e/scenarios.py` — 18 end-to-end scenarios + 5 edge cases (Playwright), and `tests/e2e/smoke.py` (all demo accounts × all permitted pages, no console errors).
