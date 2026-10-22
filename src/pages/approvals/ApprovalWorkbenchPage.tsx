import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, GitBranch, Inbox } from 'lucide-react'
import { pendingStep, requestTotal, useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { useSimulatedLoading } from '@/hooks/misc'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { DemoTag, StatusBadge } from '@/components/ui/Badge'
import { Avatar, EmptyState, SkeletonRows } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { SlaIndicator } from '@/components/data-display/ApprovalChain'
import { brands } from '@/data/catalog'
import { toUsd } from '@/utils/fx'
import { date, hoursBetween, money, relative } from '@/utils/format'
import type { SalesOrderRequest } from '@/types/domain'

type TabKey = 'mine' | 'all' | 'decided'

export default function ApprovalWorkbenchPage() {
  const { state, user, canAny } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const loading = useSimulatedLoading(350)
  const isApprover = canAny('order.approve', 'order.reject')
  const [tab, setTab] = useState<TabKey>(isApprover ? 'mine' : 'all')
  const [q, setQ] = useState('')
  const [territory, setTerritory] = useState('')
  const [stage, setStage] = useState('')
  const [sla, setSla] = useState('')

  const allPending = scope.requests.filter((r) => r.status === 'In Approval')
  const decided = state.requests.filter((r) => r.approvalSteps.some((s) => s.actedById === user.id))
  const base = tab === 'mine' ? scope.approvalQueue : tab === 'all' ? allPending : decided

  const slaState = (r: SalesOrderRequest) => {
    const s = pendingStep(r)
    if (!s?.enteredAt) return 'ok'
    const ratio = hoursBetween(s.enteredAt) / s.slaHours
    return ratio > 1 ? 'breached' : ratio > 0.6 ? 'risk' : 'ok'
  }

  const rows = useMemo(
    () =>
      base.filter(
        (r) =>
          (!q || `${r.ref} ${lookups.customer(r.customerId)?.name}`.toLowerCase().includes(q.toLowerCase())) &&
          (!territory || r.territoryId === territory) &&
          (!stage || pendingStep(r)?.stage === stage) &&
          (!sla || slaState(r) === sla),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, q, territory, stage, sla, lookups],
  )

  const brandNames = (r: SalesOrderRequest) => [...new Set(r.lines.map((l) => lookups.product(l.productId)!.brandId))].map((b) => brands.find((x) => x.id === b)!.name)
  const myStepFor = (r: SalesOrderRequest) => r.approvalSteps.find((s) => s.actedById === user.id)

  const columns: Column<SalesOrderRequest>[] = [
    { key: 'ref', header: 'Request ID', primary: true, sortValue: (r) => r.ref, cell: (r) => <span className="font-mono text-[12px] font-semibold">{r.ref}</span> },
    { key: 'customer', header: 'Distributor', sortValue: (r) => lookups.customer(r.customerId)?.name ?? '', cell: (r) => <span className="font-medium">{lookups.customer(r.customerId)?.name}</span> },
    { key: 'territory', header: 'Territory', hideOnMobile: true, sortValue: (r) => lookups.territory(r.territoryId)?.name ?? '', cell: (r) => <span className="text-muted">{lookups.territory(r.territoryId)?.name}</span> },
    {
      key: 'brand', header: 'Brand', hideOnMobile: true,
      cell: (r) => {
        const b = brandNames(r)
        return <span className="text-muted" title={b.join(', ')}>{b[0]}{b.length > 1 && ` +${b.length - 1}`}</span>
      },
    },
    { key: 'value', header: 'Requested value', align: 'right', sortValue: (r) => toUsd(requestTotal(r), r.currency), cell: (r) => <span className="font-medium tabular">{money(requestTotal(r), r.currency, { compact: true })}<span className="block text-[11px] font-normal text-muted">≈ {money(toUsd(requestTotal(r), r.currency), 'USD', { compact: true })}</span></span> },
    { key: 'submitted', header: 'Submitted', sortValue: (r) => r.createdAt, cell: (r) => <span title={date(r.createdAt)}>{relative(r.createdAt)}</span> },
    ...(tab === 'decided'
      ? ([
          { key: 'mydecision', header: 'My decision', cell: (r) => { const s = myStepFor(r)!; return <span><StatusBadge status={s.status} /><span className="mt-0.5 block text-[11px] text-muted">{relative(s.actedAt)}</span></span> } },
          { key: 'status', header: 'Request status', cell: (r) => <StatusBadge status={r.status} /> },
        ] as Column<SalesOrderRequest>[])
      : ([
          {
            key: 'stage', header: 'Current stage', sortValue: (r) => r.approvalSteps.indexOf(pendingStep(r)!),
            cell: (r) => { const s = pendingStep(r); return s ? <span className="whitespace-nowrap text-[12px]"><span className="font-medium">{s.stage}</span><span className="block text-muted">Level {r.approvalSteps.indexOf(s) + 1}/{r.approvalSteps.length}</span></span> : '—' },
          },
          {
            key: 'approver', header: 'Assigned approver', hideOnMobile: true,
            cell: (r) => { const s = pendingStep(r); const u = lookups.user(s?.approverId); return u ? <span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={u.name} size="xs" />{u.name}</span> : '—' },
          },
          {
            key: 'sla', header: 'SLA', sortValue: (r) => { const s = pendingStep(r); return s?.enteredAt ? hoursBetween(s.enteredAt) / s.slaHours : 0 },
            cell: (r) => { const s = pendingStep(r); return s ? <SlaIndicator step={s} /> : '—' },
          },
        ] as Column<SalesOrderRequest>[])),
  ]

  const breachedCount = (isApprover ? scope.approvalQueue : allPending).filter((r) => slaState(r) === 'breached').length

  return (
    <>
      <PageHeader
        title="Approval workbench"
        description={isApprover ? 'Requests waiting at your approval level, ordered by SLA risk.' : 'Monitor every request moving through territory, regional and general management approval.'}
        breadcrumbs={[{ label: 'Administration' }, { label: 'Approval Workbench' }]}
        meta={<DemoTag>Simulated workflow — not SAP approvals</DemoTag>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { l: isApprover ? 'In my queue' : 'In approval', v: (isApprover ? scope.approvalQueue : allPending).length, icon: <Inbox className="size-4" />, cls: 'text-primary bg-primary-50' },
          { l: 'SLA breached', v: breachedCount, icon: <GitBranch className="size-4" />, cls: breachedCount ? 'text-danger-700 bg-danger-50' : 'text-success-700 bg-success-50' },
          { l: 'Decided by me', v: decided.length, icon: <CheckCircle2 className="size-4" />, cls: 'text-success-700 bg-success-50' },
        ].map((k) => (
          <div key={k.l} className="card flex items-center gap-4 p-4">
            <span className={`flex size-10 items-center justify-center rounded-xl ${k.cls}`}>{k.icon}</span>
            <div><p className="text-xs text-muted">{k.l}</p><p className="text-xl font-semibold tabular">{k.v}</p></div>
          </div>
        ))}
      </div>

      <Card>
        <Tabs
          className="px-3"
          value={tab}
          onChange={setTab}
          items={[
            ...(isApprover ? [{ key: 'mine' as const, label: 'My queue', count: scope.approvalQueue.length }] : []),
            { key: 'all', label: 'All in approval', count: allPending.length },
            { key: 'decided', label: 'Decided by me', count: decided.length },
          ]}
        />
        <FilterBar active={!!(q || territory || stage || sla)} onReset={() => { setQ(''); setTerritory(''); setStage(''); setSla('') }}>
          <SearchInput value={q} onChange={setQ} placeholder="Request or distributor…" className="w-full sm:w-60" />
          <FilterSelect label="Territory" value={territory} onChange={setTerritory} options={state.territories.filter((t) => base.some((r) => r.territoryId === t.id)).map((t) => ({ value: t.id, label: t.name }))} />
          {tab !== 'decided' && <FilterSelect label="Stage" value={stage} onChange={setStage} options={['Territory Manager', 'Regional Manager', 'General Manager'].map((s) => ({ value: s, label: s }))} />}
          {tab !== 'decided' && <FilterSelect label="SLA" value={sla} onChange={setSla} options={[{ value: 'breached', label: 'Breached' }, { value: 'risk', label: 'At risk' }, { value: 'ok', label: 'On track' }]} />}
        </FilterBar>
        {loading ? (
          <SkeletonRows rows={6} />
        ) : (
          <DataTable
            key={tab}
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/app/approvals/${r.id}`)}
            initialSort={tab === 'decided' ? { key: 'submitted', dir: 'desc' } : { key: 'sla', dir: 'desc' }}
            caption="Approval queue"
            empty={<EmptyState icon={<CheckCircle2 className="size-5" />} title={tab === 'mine' ? 'Your queue is clear' : 'Nothing to show'} description={tab === 'mine' ? 'New requests at your level will appear here.' : 'Adjust filters or switch tabs.'} />}
          />
        )}
      </Card>
    </>
  )
}
