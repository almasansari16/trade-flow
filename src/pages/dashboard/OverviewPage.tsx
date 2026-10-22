import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  GitBranch,
  PackageCheck,
  Plus,
  Receipt,
  Timer,
  Truck,
  Undo2,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'
import { requestTotal, useLookups, useStore } from '@/app/store'
import { useScope, useTasks } from '@/hooks/useScope'
import { useSimulatedLoading } from '@/hooks/misc'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { Card, CardHeader } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Avatar, ProgressBar, Skeleton } from '@/components/ui/misc'
import { ActivityTimeline } from '@/components/data-display/Timeline'
import { ACTION_LABEL, stageById } from '@/workflow/engine'
import { toUsd } from '@/utils/fx'
import { date, hoursBetween, money, num, relative } from '@/utils/format'
import { cn } from '@/utils/cn'
import { SHIPMENT_FLOW } from '@/types/domain'
import { CHART, ChartCard, Donut, illustrativeMonthly, RequestList, SimpleBars, TrendArea } from './widgets'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function OverviewPage() {
  const { user, state, can, canAny } = useStore()
  const lookups = useLookups()
  const loading = useSimulatedLoading(500, user.id)
  const firstName = user.name.split(' ')[0]
  const roles = user.roleIds.map((r) => lookups.role(r)?.name ?? r).join(' · ')

  const actions =
    canAny('order.create', 'order.create_on_behalf') ? (
      <>
        <ButtonLink to="/app/catalog" variant="secondary" icon={<BookOpen className="size-4" />}>Browse catalog</ButtonLink>
        <ButtonLink to="/app/requests/new" icon={<Plus className="size-4" />}>New order request</ButtonLink>
      </>
    ) : canAny('order.approve') ? (
      <ButtonLink to="/app/approvals" icon={<GitBranch className="size-4" />}>Open approval workbench</ButtonLink>
    ) : can('application.view_own') && !user.customerId ? (
      <ButtonLink to="/app/my-applications" icon={<BadgeCheck className="size-4" />}>My applications</ButtonLink>
    ) : null

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={`${date(new Date().toISOString(), 'long')} · ${roles || 'No role assigned'}${user.customerId ? ` · ${state.customers.find((c) => c.id === user.customerId)?.name ?? ''}` : ''}`}
        actions={actions}
      />
      {loading ? <DashboardSkeleton /> : (
        <div className="space-y-6">
          <ApplicationWidgets />
          <PermissionDashboard />
        </div>
      )}
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-[14px] xl:col-span-2" />
        <Skeleton className="h-80 rounded-[14px]" />
      </div>
    </div>
  )
}

/**
 * The main dashboard is composed from permissions (not role names). Users with
 * several roles get the panel of their most operational capability.
 */
function PermissionDashboard() {
  const { user, can } = useStore()
  if (user.kind === 'external' && user.customerId && can('order.view_own')) return <DistributorDashboard />
  if (can('order.create_on_behalf')) return <CoordinatorDashboard />
  if (can('order.approve')) return <ApproverDashboard />
  if (can('payment.verify')) return <FinanceDashboard />
  if (can('shipment.update')) return <LogisticsDashboard />
  if (can('user.manage') || can('audit.view')) return <AdminDashboard />
  if (can('application.view_own')) return null
  return <TaskPanel />
}

// ─── Distributor applications (personalised, scope-limited) ──────────────

function ApplicationWidgets() {
  const { state, can, user } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const reviewer = can('application.view_assigned') || can('application.view_all')
  const own = can('application.view_own') && scope.myApplications.length > 0
  const applicantOnly = can('application.view_own') && !user.customerId
  if (!reviewer && !own && !applicantOnly) return null

  const stageKind = (id?: string) => stageById(state.onboardingWorkflow, id)?.kind
  const pendingReview = scope.applicationQueue.filter((a) => stageKind(a.currentStageId) === 'review')
  const awaitingApproval = scope.applicationQueue.filter((a) => stageKind(a.currentStageId) === 'approval')
  const returnedMine = scope.myApplications.filter((a) => a.status === 'Returned for Correction')
  const handled = (a: (typeof scope.applications)[number]) => a.history.some((e) => e.actorId === user.id)
  const decidedScope = reviewer ? scope.applications.filter((a) => can('application.view_all') || handled(a)) : scope.myApplications
  const approved = decidedScope.filter((a) => a.status === 'Approved')
  const rejected = decidedScope.filter((a) => a.status === 'Rejected')
  const internal = can('application.view_internal')
  const stageLabel = (id?: string) => stageById(state.onboardingWorkflow, id)?.publicLabel ?? 'Review'
  /** Applicant-facing wording (no internal stage names or reviewer identities). */
  const applicantLabel = (e: (typeof scope.applications)[number]['history'][number]) =>
    e.action === 'approve' ? (e.toStatus === 'Approved' ? 'Final approval granted' : `${stageLabel(e.fromStageId)} completed`) : e.action === 'start_review' ? `${stageLabel(e.toStageId)} started` : ACTION_LABEL[e.action]
  const source = reviewer ? scope.applications : scope.myApplications
  const activity = source
    .flatMap((a) => a.history.filter((e) => (internal || e.visibility === 'public') && e.action !== 'assign').map((e, i) => ({ e, a, i })))
    .sort((x, y) => y.e.at.localeCompare(x.e.at) || y.i - x.i)
    .slice(0, 6)

  return (
    <section aria-labelledby="apps-heading" className="space-y-4">
      <h2 id="apps-heading" className="text-[15px] font-semibold">Distributor applications</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(own || applicantOnly) && (
          <StatCard label="My applications" value={scope.myApplications.length} icon={<BadgeCheck className="size-4" />} hint={`${scope.myApplications.filter((a) => !['Approved', 'Rejected', 'Draft'].includes(a.status)).length} in progress`} to="/app/my-applications" />
        )}
        {(own || applicantOnly) && (
          <StatCard label="Returned for correction" value={returnedMine.length} icon={<Undo2 className="size-4" />} tone={returnedMine.length ? 'warning' : 'success'} hint={returnedMine.length ? 'Your action is required' : 'Nothing to correct'} to="/app/my-applications" />
        )}
        {reviewer && can('application.review') && (
          <StatCard label="Pending my review" value={pendingReview.length} icon={<FileCheck2 className="size-4" />} tone={pendingReview.length ? 'warning' : 'success'} hint="Initial review stage" to="/app/applications?tab=action" />
        )}
        {reviewer && can('application.approve') && (
          <StatCard label="Awaiting my approval" value={awaitingApproval.length} icon={<GitBranch className="size-4" />} tone={awaitingApproval.length ? 'warning' : 'success'} hint="Approval stages assigned to you" to="/app/applications?tab=action" />
        )}
        {reviewer && (
          <StatCard label="Requiring my action" value={scope.applicationQueue.length} icon={<Timer className="size-4" />} tone="primary" hint="All stages" to="/app/applications?tab=action" />
        )}
        <StatCard label={reviewer && !can('application.view_all') ? 'Approved (handled by me)' : 'Approved'} value={approved.length} icon={<CheckCircle2 className="size-4" />} tone="success" hint={`${rejected.length} rejected`} to={reviewer ? '/app/applications?tab=approved' : '/app/my-applications'} />
      </div>
      {(activity.length > 0 || reviewer) && (
        <Card>
          <CardHeader title="Recent workflow activity" description={reviewer ? 'Applications in your scope' : 'Your applications'} actions={<Link to={reviewer ? '/app/applications' : '/app/my-applications'} className="text-[13px] font-medium text-primary hover:underline">Open</Link>} />
          <ul className="divide-y divide-line">
            {activity.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted">No activity yet.</li>}
            {activity.map(({ e, a }) => (
              <li key={e.id}>
                <Link to={a.applicantUserId === user.id ? `/app/my-applications/${a.id}` : `/app/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                  <Avatar name={a.companyName || a.ref} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{reviewer ? ACTION_LABEL[e.action] : applicantLabel(e)} · {a.ref}</span>
                    <span className="block truncate text-xs text-muted">
                      {a.companyName}
                      {reviewer && e.actorId !== 'system' ? ` · ${lookups.user(e.actorId)?.name ?? ''}` : ''} · {relative(e.at)}
                    </span>
                  </span>
                  <StatusBadge status={e.toStatus} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}

const ACTIVE: string[] = ['In Approval', 'Changes Requested', 'Approved', 'Awaiting Payment', 'Payment Verified', 'In Fulfillment', 'Ready for Collection']

function TaskPanel({ limit = 5 }: { limit?: number }) {
  const tasks = useTasks()
  return (
    <Card>
      <CardHeader title="My tasks" description={`${tasks.length} open`} actions={<Link to="/app/tasks" className="text-[13px] font-medium text-primary hover:underline">All tasks</Link>} />
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="mt-2 text-[13px] font-medium">Nothing waiting on you</p>
          <p className="text-xs text-muted">New tasks appear here as work moves to your role.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {tasks.slice(0, limit).map((t) => (
            <li key={t.id}>
              <Link to={t.link} className="flex items-start gap-3 px-5 py-3 hover:bg-canvas">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', t.priority === 'high' ? 'bg-danger' : t.priority === 'medium' ? 'bg-warning' : 'bg-slate-300')} aria-label={`${t.priority} priority`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted">{t.description}</span>
                </span>
                <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ─── Distributor ──────────────────────────────────────────────────────────

function DistributorDashboard() {
  const scope = useScope()
  const { state } = useStore()
  const customer = scope.customers[0]
  const currency = customer?.currency ?? 'USD'
  const open = scope.requests.filter((r) => ['In Approval', 'Changes Requested'].includes(r.status))
  const payable = scope.invoices.filter((i) => ['Issued', 'Receipt Uploaded'].includes(i.status))
  const inFulfil = scope.shipments.filter((s) => s.status !== 'Collected' && SHIPMENT_FLOW.indexOf(s.status) >= 2)
  const ytd = scope.requests.filter((r) => !['Draft', 'Rejected', 'Cancelled', 'In Approval', 'Changes Requested'].includes(r.status)).reduce((s, r) => s + requestTotal(r), 0)
  const active = scope.requests.filter((r) => ACTIVE.includes(r.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const allActivity = scope.requests.flatMap((r) => r.activity.map((a) => ({ ...a, action: `${a.action} — ${r.ref}` }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6)
  const nameOf = (id: string) => state.users.find((u) => u.id === id)?.name ?? 'System'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Requests in approval" value={open.length} icon={<GitBranch className="size-4" />} tone="warning" hint={`${open.filter((r) => r.status === 'Changes Requested').length} need changes`} to="/app/requests" />
        <StatCard label="Awaiting payment" value={money(payable.reduce((s, i) => s + i.total, 0), currency, { compact: true })} icon={<Wallet className="size-4" />} tone="primary" hint={`${payable.length} proforma invoice(s)`} to="/app/invoices" />
        <StatCard label="In fulfilment" value={inFulfil.length} icon={<Truck className="size-4" />} tone="success" hint={`${inFulfil.filter((s) => s.status === 'Ready for Collection').length} ready to collect`} to="/app/shipments" />
        <StatCard label="Confirmed order value" value={money(ytd, currency, { compact: true })} icon={<Receipt className="size-4" />} tone="neutral" delta={{ value: '12.4%', positive: true }} hint="vs last period (demo)" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Active orders" description="Where each request is in the journey" actions={<Link to="/app/requests" className="text-[13px] font-medium text-primary hover:underline">All requests</Link>} />
          <ul className="divide-y divide-line">
            {active.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link to={`/app/requests/${r.id}`} className="block px-5 py-4 hover:bg-canvas">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-medium">
                      <span className="font-mono">{r.ref}</span>
                      {r.customerPo && <span className="text-muted">PO {r.customerPo}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-[13px] font-semibold tabular">{money(requestTotal(r), r.currency)}</span>
                      <StatusBadge status={r.status} />
                    </span>
                  </div>
                  <JourneyBar status={r.status} />
                </Link>
              </li>
            ))}
            {active.length === 0 && <li className="px-5 py-10 text-center text-[13px] text-muted">No active orders. Start one from the catalogue.</li>}
          </ul>
        </Card>
        <TaskPanel />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Monthly order value" description={`${currency} · last 12 months`} className="xl:col-span-2">
          <TrendArea data={illustrativeMonthly(2, 180000)} valueLabel="Order value" />
        </ChartCard>
        <Card>
          <CardHeader title="Recent activity" />
          <div className="p-5">
            <ActivityTimeline entries={allActivity} nameOf={nameOf} />
          </div>
        </Card>
      </div>
    </div>
  )
}

const JOURNEY = ['Submitted', 'Approval', 'Proforma', 'Payment', 'Warehouse', 'Collection']
function journeyIndex(status: string) {
  const m: Record<string, number> = { 'In Approval': 1, 'Changes Requested': 1, Approved: 2, 'Awaiting Payment': 3, 'Payment Verified': 4, 'In Fulfillment': 4, 'Ready for Collection': 5, Collected: 6 }
  return m[status] ?? 0
}
function JourneyBar({ status }: { status: string }) {
  const idx = journeyIndex(status)
  return (
    <div className="mt-3">
      <div className="flex gap-1">
        {JOURNEY.map((_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < idx ? 'bg-success' : i === idx ? (status === 'Changes Requested' ? 'bg-warning' : 'bg-primary') : 'bg-slate-100')} />
        ))}
      </div>
      <div className="mt-1.5 hidden grid-cols-6 text-[10px] text-muted sm:grid">
        {JOURNEY.map((j, i) => <span key={j} className={cn(i === idx && 'font-semibold text-ink')}>{j}</span>)}
      </div>
    </div>
  )
}

// ─── Sales coordinator ────────────────────────────────────────────────────

function CoordinatorDashboard() {
  const scope = useScope()
  const lookups = useLookups()
  const apps = scope.applicationQueue
  const inApproval = scope.requests.filter((r) => r.status === 'In Approval')
  const breached = inApproval.filter((r) => {
    const s = r.approvalSteps.find((x) => x.status === 'Pending')
    return s?.enteredAt && hoursBetween(s.enteredAt) > s.slaHours
  })
  const followUps = scope.threads.filter((t) => ['Overdue', 'Due Today', 'Open'].includes(t.followUp.status))
  const statusCounts = ['Draft', 'In Approval', 'Changes Requested', 'Awaiting Payment', 'In Fulfillment', 'Ready for Collection'].map((s) => ({
    label: s.replace('Ready for ', '').replace('Changes Requested', 'Changes'),
    value: scope.requests.filter((r) => r.status === s || (s === 'In Fulfillment' && r.status === 'Payment Verified')).length,
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications to review" value={apps.length} icon={<BadgeCheck className="size-4" />} hint={`${apps.filter((a) => a.status === 'Submitted' || a.status === 'Resubmitted').length} new or resubmitted`} to="/app/applications?tab=action" />
        <StatCard label="Requests in approval" value={inApproval.length} icon={<GitBranch className="size-4" />} tone="warning" to="/app/requests" hint={money(inApproval.reduce((s, r) => s + toUsd(requestTotal(r), r.currency), 0), 'USD', { compact: true }) + ' total'} />
        <StatCard label="SLA breaches" value={breached.length} icon={<AlertTriangle className="size-4" />} tone={breached.length ? 'danger' : 'success'} hint="Approval stage over SLA" to="/app/approvals" />
        <StatCard label="Follow-ups open" value={followUps.length} icon={<CalendarClock className="size-4" />} tone="neutral" hint={`${followUps.filter((t) => t.followUp.status === 'Overdue').length} overdue`} to="/app/follow-ups" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Requests by stage" description="Current pipeline across all territories" demo={false} className="xl:col-span-2">
          <SimpleBars data={statusCounts} valueLabel="Requests" />
        </ChartCard>
        <TaskPanel limit={6} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <RequestList requests={inApproval.slice(0, 5)} title="Waiting on approvers" description="Chase breached SLAs first" to="/app/approvals" empty="No requests in approval." showSla />
        <Card>
          <CardHeader title="Applications waiting for you" actions={<Link to="/app/applications" className="text-[13px] font-medium text-primary hover:underline">Review</Link>} />
          <ul className="divide-y divide-line">
            {apps.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted">No applications waiting for you.</li>}
            {apps.map((a) => (
              <li key={a.id}>
                <Link to={`/app/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas">
                  <Avatar name={a.companyName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{a.companyName}</span>
                    <span className="block text-xs text-muted">{a.ref} · {a.city}, {lookups.territory(a.territoryId)?.name} · {relative(a.submittedAt)}</span>
                  </span>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

// ─── Approvers ────────────────────────────────────────────────────────────

function ApproverDashboard() {
  const scope = useScope()
  const { user, state } = useStore()
  const lookups = useLookups()
  const queue = scope.approvalQueue
  const breached = queue.filter((r) => {
    const s = r.approvalSteps.find((x) => x.status === 'Pending')!
    return s.enteredAt && hoursBetween(s.enteredAt) > s.slaHours
  })
  const myActions = state.requests.flatMap((r) => r.approvalSteps.filter((s) => s.actedById === user.id && s.actedAt).map((s) => ({ r, s })))
  const approved = myActions.filter((x) => x.s.status === 'Approved')
  const avgHours = myActions.length ? myActions.reduce((sum, x) => sum + hoursBetween(x.s.enteredAt!, x.s.actedAt!), 0) / myActions.length : 0
  const byTerritory = state.territories
    .filter((t) => scope.requests.some((r) => r.territoryId === t.id))
    .map((t) => ({
      label: t.name,
      value: Math.round(scope.requests.filter((r) => r.territoryId === t.id && !['Draft', 'Rejected', 'Cancelled'].includes(r.status)).reduce((s, r) => s + toUsd(requestTotal(r), r.currency), 0)),
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting my approval" value={queue.length} icon={<GitBranch className="size-4" />} tone="warning" to="/app/approvals" hint={money(queue.reduce((s, r) => s + toUsd(requestTotal(r), r.currency), 0), 'USD', { compact: true }) + ' in value'} />
        <StatCard label="SLA breached" value={breached.length} icon={<Timer className="size-4" />} tone={breached.length ? 'danger' : 'success'} hint={breached.length ? 'Act on these first' : 'All within SLA'} />
        <StatCard label="Approved by me" value={approved.length} icon={<CheckCircle2 className="size-4" />} tone="success" hint={money(approved.reduce((s, x) => s + toUsd(requestTotal(x.r), x.r.currency), 0), 'USD', { compact: true }) + ' approved'} />
        <StatCard label="Avg. decision time" value={`${num(avgHours, 1)}h`} icon={<Clock className="size-4" />} tone="neutral" hint="From queue entry to decision" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RequestList requests={queue} title="Approval queue" description={user.territoryIds?.length ? `Scope: ${user.territoryIds.map((t) => lookups.territory(t)?.name).join(', ')}` : user.regionId ? `Scope: ${lookups.region(user.regionId)?.name}` : 'Final approvals for strategic orders'} to="/app/approvals" empty="Queue is clear — nice work." showSla />
        </div>
        <TaskPanel />
      </div>
      <ChartCard title="Pipeline value by territory" description="USD equivalent · requests in scope (excludes drafts and rejections)" demo={false}>
        <SimpleBars data={byTerritory} valueLabel="Value" currency="USD" horizontal />
      </ChartCard>
    </div>
  )
}

// ─── Finance ──────────────────────────────────────────────────────────────

function FinanceDashboard() {
  const { state } = useStore()
  const lookups = useLookups()
  const toIssue = state.requests.filter((r) => r.status === 'Approved' && !r.invoiceId)
  const toVerify = state.payments.filter((p) => p.status === 'Receipt Uploaded')
  const outstanding = state.invoices.filter((i) => ['Issued', 'Receipt Uploaded'].includes(i.status))
  const verified = state.invoices.filter((i) => i.status === 'Payment Verified')
  const statusData = [
    { label: 'Issued', value: state.invoices.filter((i) => i.status === 'Issued').length, color: CHART.slate },
    { label: 'Receipt uploaded', value: state.invoices.filter((i) => i.status === 'Receipt Uploaded').length, color: CHART.primary },
    { label: 'Payment verified', value: verified.length, color: CHART.teal },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Proformas to issue" value={toIssue.length} icon={<FileCheck2 className="size-4" />} tone="warning" hint="Approved requests" to="/app/orders" />
        <StatCard label="Receipts to verify" value={toVerify.length} icon={<Wallet className="size-4" />} tone="primary" to="/app/payments" hint="Uploaded by distributors" />
        <StatCard label="Outstanding" value={money(outstanding.reduce((s, i) => s + toUsd(i.total, i.currency), 0), 'USD', { compact: true })} icon={<Receipt className="size-4" />} tone="neutral" hint={`${outstanding.length} invoice(s), USD equiv.`} to="/app/invoices" />
        <StatCard label="Verified (all time)" value={money(verified.reduce((s, i) => s + toUsd(i.total, i.currency), 0), 'USD', { compact: true })} icon={<CheckCircle2 className="size-4" />} tone="success" hint={`${verified.length} payments`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Payments awaiting verification" actions={<Link to="/app/payments" className="text-[13px] font-medium text-primary hover:underline">Open payments</Link>} />
          <ul className="divide-y divide-line">
            {toVerify.length === 0 && <li className="px-5 py-10 text-center text-[13px] text-muted">No receipts waiting.</li>}
            {toVerify.map((p) => (
              <li key={p.id}>
                <Link to={`/app/payments?verify=${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-canvas">
                  <Wallet className="size-4 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{lookups.customer(p.customerId)?.name}</span>
                    <span className="block text-xs text-muted">{lookups.invoice(p.invoiceId)?.number} · uploaded {relative(p.receiptFile?.uploadedAt)}</span>
                  </span>
                  <span className="text-[13px] font-semibold tabular">{money(p.amount, p.currency)}</span>
                </Link>
              </li>
            ))}
            {toIssue.map((r) => (
              <li key={r.id}>
                <Link to={`/app/requests/${r.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-canvas">
                  <FileCheck2 className="size-4 text-warning" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">Issue proforma · {r.ref}</span>
                    <span className="block text-xs text-muted">{lookups.customer(r.customerId)?.name} · approved {relative(r.updatedAt)}</span>
                  </span>
                  <span className="text-[13px] font-semibold tabular">{money(requestTotal(r), r.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <ChartCard title="Proforma status" demo={false}>
          <Donut data={statusData} centerLabel="invoices" centerValue={String(state.invoices.length)} />
        </ChartCard>
      </div>
      <ChartCard title="Cash collected" description="USD equivalent · last 12 months">
        <TrendArea data={illustrativeMonthly(5, 420000)} valueLabel="Collected" currency="USD" />
      </ChartCard>
    </div>
  )
}

// ─── Logistics ────────────────────────────────────────────────────────────

function LogisticsDashboard() {
  const { state } = useStore()
  const lookups = useLookups()
  const cols = ['Payment Verified', 'Ready for Warehouse Preparation', 'Documents in Progress', 'Ready for Collection'] as const
  const count = (s: string) => state.shipments.filter((x) => x.status === s).length
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready to prepare" value={count('Payment Verified')} icon={<Warehouse className="size-4" />} tone="warning" hint="Payment verified" to="/app/shipments" />
        <StatCard label="Documents in progress" value={count('Documents in Progress') + count('Ready for Warehouse Preparation')} icon={<FileCheck2 className="size-4" />} tone="primary" to="/app/shipments" />
        <StatCard label="Ready for collection" value={count('Ready for Collection')} icon={<PackageCheck className="size-4" />} tone="success" to="/app/collection" />
        <StatCard label="Awaiting payment" value={count('Awaiting Payment') + count('Approved')} icon={<Clock className="size-4" />} tone="neutral" hint="Upcoming workload" />
      </div>
      <div>
        <h2 className="mb-3 text-[15px] font-semibold">Fulfilment board</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cols.map((c) => {
            const items = state.shipments.filter((s) => s.status === c)
            return (
              <div key={c} className="rounded-[14px] border border-line bg-slate-50/80 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-[13px] font-semibold">{c}</p>
                  <span className="rounded-full bg-surface px-2 text-xs font-medium text-muted ring-1 ring-line">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Empty</p>}
                  {items.map((s) => (
                    <Link key={s.id} to={`/app/shipments/${s.id}`} className="block rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-card)] hover:border-primary/40">
                      <p className="font-mono text-xs font-medium">{s.ref}</p>
                      <p className="mt-0.5 truncate text-[13px] font-medium">{lookups.customer(s.customerId)?.name}</p>
                      <p className="mt-2 flex items-center justify-between text-xs text-muted">
                        <span>{s.cartons} ctns · {num(s.grossWeightKg)} kg</span>
                        <span>{relative(s.history.at(-1)?.at)}</span>
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <TaskPanel />
    </div>
  )
}

// ─── Administrator ────────────────────────────────────────────────────────

function AdminDashboard() {
  const { state } = useStore()
  const failed = state.integrationEvents.filter((e) => e.status === 'Failed')
  const audit = state.requests.flatMap((r) => r.activity.map((a) => ({ ...a, action: `${a.action} — ${r.ref}` }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7)
  const nameOf = (id: string) => state.users.find((u) => u.id === id)?.name ?? 'System'
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active users" value={state.users.filter((u) => u.active && u.id !== 'u-system').length} icon={<Users className="size-4" />} to="/app/admin/users" hint={`${state.users.filter((u) => !u.active).length} inactive`} />
        <StatCard label="Territories" value={state.territories.length} icon={<GitBranch className="size-4" />} tone="neutral" hint="4 regions" to="/app/admin/territories" />
        <StatCard label="Sync failures" value={failed.length} icon={<AlertTriangle className="size-4" />} tone={failed.length ? 'danger' : 'success'} hint="Simulated integration" to="/app/admin/integration" />
        <StatCard label="Approval rules" value={state.approvalRules.filter((r) => r.active).length} icon={<ClipboardList className="size-4" />} tone="primary" hint="Active value bands" to="/app/admin/workflow" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Integration health" description="Simulated channels — no live ERP connection" icon={<Activity className="size-5" />} actions={<Link to="/app/admin/integration" className="text-[13px] font-medium text-primary hover:underline">Monitor</Link>} />
          <ul className="divide-y divide-line">
            {state.integrationChannels.map((c) => (
              <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 sm:grid-cols-[1fr_140px_auto]">
                <div>
                  <p className="text-[13px] font-medium">{c.name}</p>
                  <p className="text-xs text-muted">Last sync {relative(c.lastSyncAt)} · {c.latencyMs} ms</p>
                </div>
                <div className="hidden sm:block">
                  <ProgressBar value={c.successRate} tone={c.successRate > 97 ? 'success' : 'warning'} />
                  <p className="mt-1 text-right text-[11px] text-muted tabular">{c.successRate}% success</p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Audit trail" description="Latest workflow events" />
          <div className="p-5"><ActivityTimeline entries={audit} nameOf={nameOf} /></div>
        </Card>
      </div>
    </div>
  )
}
