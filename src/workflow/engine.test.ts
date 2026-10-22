/**
 * Unit tests for the workflow engine, applicant-safe projection, authorization helpers
 * and the mock tracking service. These call the rules directly (bypassing the UI),
 * which is how a server-side implementation would have to enforce them.
 */
import { describe, expect, it } from 'vitest'
import { applications as seedApps } from '@/data/applications'
import { regions, territories, users } from '@/data/org'
import { defaultRoles } from '@/auth/roles'
import { canViewApplication, makeCan, permissionsFor } from '@/auth/authorize'
import { defaultOnboardingWorkflow } from './onboarding'
import { applyReviewerAction, availableActions, eligiblePreviousStages, resubmit, submitDraft, type WorkflowCtx } from './engine'
import { toPublicView } from './publicView'
import { createMockTrackingService, GENERIC_TRACK_ERROR } from './tracking'
import type { RegistrationApplication, WorkflowDef } from '@/types/domain'

const ctx = (workflow: WorkflowDef = defaultOnboardingWorkflow): WorkflowCtx => ({ workflow: structuredClone(workflow), users, roles: defaultRoles, territories, regions })
const user = (id: string) => users.find((u) => u.id === id)!
const canOf = (id: string) => makeCan(permissionsFor(defaultRoles, user(id)))
const app = (id: string) => structuredClone(seedApps.find((a) => a.id === id)!) as RegistrationApplication

describe('availability and authorization', () => {
  it('only the assigned stage owner gets actions', () => {
    const a = app('a-001') // commercial approval, assigned to Faisal (u-tm2)
    expect(availableActions(ctx(), user('u-tm2'), canOf('u-tm2'), a).map((x) => x.action)).toContain('approve')
    expect(availableActions(ctx(), user('u-tm1'), canOf('u-tm1'), a)).toEqual([]) // same role, not assigned
    expect(availableActions(ctx(), user('u-gm'), canOf('u-gm'), a)).toEqual([]) // later stage
    expect(availableActions(ctx(), user('u-audit'), canOf('u-audit'), a)).toEqual([]) // read-only
  })

  it('refuses a transition by a user outside the stage even when called directly', () => {
    const a = app('a-001')
    const r = applyReviewerAction(ctx(), a, user('u-sc'), canOf('u-sc'), 'approve', {})
    expect(r.ok).toBe(false)
    expect(a.status).toBe('Pending Approval')
    expect(a.history).toHaveLength(app('a-001').history.length)
  })

  it('requires the stage-specific permission (initial reviewer cannot reject by default)', () => {
    const a = app('a-003')
    applyReviewerAction(ctx(), a, user('u-sc2'), canOf('u-sc2'), 'start_review', {})
    const r = applyReviewerAction(ctx(), a, user('u-sc2'), canOf('u-sc2'), 'reject', { publicRemarks: 'Not suitable for our network.' })
    expect(r).toEqual({ ok: false, error: expect.stringContaining('not authorised') })
  })

  it('blocks decisions until the review is started', () => {
    const a = app('a-003')
    const r = applyReviewerAction(ctx(), a, user('u-sc2'), canOf('u-sc2'), 'approve', {})
    expect(r).toEqual({ ok: false, error: 'Start the review first.' })
  })

  it('first stage has no previous approver', () => {
    const a = app('a-003')
    expect(eligiblePreviousStages(ctx(), a)).toEqual([])
    const roles = defaultRoles.map((r) => (r.id === 'sales_coordinator' ? { ...r, permissions: [...r.permissions, 'application.return_to_previous_approver'] } : r))
    const c = { ...ctx(), roles }
    const can = makeCan(permissionsFor(roles, user('u-sc2')))
    applyReviewerAction(c, a, user('u-sc2'), can, 'start_review', {})
    const ret = availableActions(c, user('u-sc2'), can, a).find((x) => x.action === 'return_to_previous')!
    expect(ret.allowed).toBe(false)
    expect(ret.reason).toMatch(/no previous approver/)
  })

  it('record-level visibility follows ownership, assignment and history', () => {
    const stageRole = (id?: string) => defaultOnboardingWorkflow.stages.find((s) => s.id === id)?.roleId
    expect(canViewApplication(user('u-sc'), canOf('u-sc'), app('a-003'), stageRole)).toBe(false) // other region
    expect(canViewApplication(user('u-sc2'), canOf('u-sc2'), app('a-003'), stageRole)).toBe(true)
    expect(canViewApplication(user('u-sc'), canOf('u-sc'), app('a-001'), stageRole)).toBe(true) // acted on it
    expect(canViewApplication(user('u-app2'), canOf('u-app2'), app('a-001'), stageRole)).toBe(false) // other applicant
    expect(canViewApplication(user('u-audit'), canOf('u-audit'), app('a-001'), stageRole)).toBe(true) // view_all
    const draft = { ...app('a-001'), status: 'Draft' as const, applicantUserId: 'u-app1' }
    expect(canViewApplication(user('u-audit'), canOf('u-audit'), draft, stageRole)).toBe(false) // drafts are private
  })
})

describe('transitions', () => {
  it('mandatory remarks for reject, return and return-to-previous', () => {
    const a = app('a-001')
    const tm = user('u-tm2')
    expect(applyReviewerAction(ctx(), a, tm, canOf('u-tm2'), 'reject', { publicRemarks: 'no' }).ok).toBe(false)
    expect(applyReviewerAction(ctx(), a, tm, canOf('u-tm2'), 'return_to_requester', { publicRemarks: 'Please fix the address details.' }).ok).toBe(false) // no sections
    expect(applyReviewerAction(ctx(), a, tm, canOf('u-tm2'), 'return_to_previous', { targetStageId: 'initial_review' }).ok).toBe(false)
  })

  it('return to previous approver goes to the last approver of that stage; findings stay internal', () => {
    const a = app('a-001')
    const r = applyReviewerAction(ctx(), a, user('u-tm2'), canOf('u-tm2'), 'return_to_previous', { targetStageId: 'initial_review', remarks: 'SECRET findings for Priya only' })
    expect(r.ok).toBe(true)
    expect(a.currentStageId).toBe('initial_review')
    expect(a.assignedToUserId).toBe('u-sc')
    const view = toPublicView(defaultOnboardingWorkflow, a)
    expect(JSON.stringify(view)).not.toContain('SECRET')
    expect(JSON.stringify(view)).not.toContain('Priya')
  })

  it('history is append-only across a full cycle and final approval is flagged', () => {
    const a = app('a-006') // final approval, GM
    const before = structuredClone(a.history)
    const r = applyReviewerAction(ctx(), a, user('u-gm'), canOf('u-gm'), 'approve', { publicRemarks: 'Welcome aboard.' })
    expect(r).toMatchObject({ ok: true, finalApproved: true })
    expect(a.status).toBe('Approved')
    expect(a.history.slice(0, before.length)).toEqual(before)
  })

  it('correction → resubmit increments the revision and routes back to the returning reviewer', () => {
    const a = app('a-003')
    applyReviewerAction(ctx(), a, user('u-sc2'), canOf('u-sc2'), 'start_review', {})
    applyReviewerAction(ctx(), a, user('u-sc2'), canOf('u-sc2'), 'return_to_requester', { publicRemarks: 'Upload the current VAT certificate.', editableSections: ['documents'] })
    expect(a.status).toBe('Returned for Correction')
    const r = resubmit(ctx(), a, user('u-app3'), 'Uploaded')
    expect(r.ok).toBe(true)
    expect(a.revision).toBe(2)
    expect(a.revisions.map((x) => x.revision)).toEqual([1, 2])
    expect(a.status).toBe('Resubmitted')
    expect(a.assignedToUserId).toBe('u-sc2')
  })

  it('resubmit routing is configurable (first stage)', () => {
    const wf = { ...structuredClone(defaultOnboardingWorkflow), resubmitRouting: 'first_stage' as const }
    const a = app('a-001')
    applyReviewerAction(ctx(wf), a, user('u-tm2'), canOf('u-tm2'), 'return_to_requester', { publicRemarks: 'Re-check the trade licence copy.', editableSections: ['documents'] })
    resubmit(ctx(wf), a, user('u-app1'), '')
    expect(a.currentStageId).toBe('initial_review')
  })

  it('an activated stage becomes part of the route', () => {
    const wf = structuredClone(defaultOnboardingWorkflow)
    wf.stages.find((s) => s.id === 'credit_check')!.active = true
    const a = app('a-003')
    applyReviewerAction(ctx(wf), a, user('u-sc2'), canOf('u-sc2'), 'start_review', {})
    applyReviewerAction(ctx(wf), a, user('u-sc2'), canOf('u-sc2'), 'approve', {})
    expect(a.currentStageId).toBe('credit_check')
    expect(a.assignedToUserId).toBe('u-fin')
  })

  it('draft submission refuses non-drafts', () => {
    expect(submitDraft(ctx(), app('a-001'), user('u-app1')).ok).toBe(false)
  })
})

describe('public tracking (mock service)', () => {
  const a = app('a-002')
  const svc = createMockTrackingService(() => ({ applications: [a], workflow: defaultOnboardingWorkflow, applicantEmailOf: (x) => [x.contact.email] }))
  it('requires reference + matching email; errors are generic', async () => {
    expect((await svc.trackByEmail(a.ref, 'neema@lagoonbeauty.example')).ok).toBe(true)
    expect(await svc.trackByEmail(a.ref, 'x@y.example')).toMatchObject({ ok: false, error: GENERIC_TRACK_ERROR })
    expect(await svc.trackByEmail('APP-2026-9999', 'neema@lagoonbeauty.example')).toMatchObject({ ok: false, error: GENERIC_TRACK_ERROR })
  })
  it('token links must match and not be expired', async () => {
    expect((await svc.trackByToken(a.ref, a.trackingToken)).ok).toBe(true)
    expect((await svc.trackByToken(a.ref, 'nope')).ok).toBe(false)
    a.trackingTokenExpiresAt = new Date(Date.now() - 1000).toISOString()
    expect(await svc.trackByToken(a.ref, a.trackingToken)).toMatchObject({ ok: false, error: expect.stringContaining('expired') })
  })
  it('the public projection never contains internal remarks', () => {
    const v = toPublicView(defaultOnboardingWorkflow, app('a-004'))
    const internal = app('a-004').history.map((e) => e.remarks).filter(Boolean)
    for (const r of internal) expect(JSON.stringify(v)).not.toContain(r!)
  })
})
