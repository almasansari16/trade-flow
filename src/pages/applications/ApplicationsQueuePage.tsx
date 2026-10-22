import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileCheck2, Inbox } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/misc'
import { DataTable } from '@/components/data-display/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/components/data-display/FilterBar'
import { activeStages, stageById } from '@/workflow/engine'
import { APPLICATION_STATUSES, type RegistrationApplication } from '@/types/domain'
import { hoursBetween, relative } from '@/utils/format'
import { cn } from '@/utils/cn'

type QueueTab = 'action' | 'progress' | 'returned' | 'approved' | 'rejected' | 'all'
const IN_FLIGHT = ['Submitted', 'Under Review', 'Resubmitted', 'Pending Approval']

/**
 * Reviewer / approver work queue. Every list and count is limited to the
 * applications this user may see (assigned, stage-responsible, or view_all).
 */
export default function ApplicationsQueuePage() {
  const { state, can } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as QueueTab) || (scope.applicationQueue.length ? 'action' : 'progress')
  const [q, setQ] = useState('')
  const [stageF, setStageF] = useState('')
  const [statusF, setStatusF] = useState('')

  const actionIds = new Set(scope.applicationQueue.map((a) => a.id))
  const buckets: Record<QueueTab, RegistrationApplication[]> = useMemo(
    () => ({
      action: scope.applicationQueue,
      progress: scope.applications.filter((a) => IN_FLIGHT.includes(a.status)),
      returned: scope.applications.filter((a) => a.status === 'Returned for Correction'),
      approved: scope.applications.filter((a) => a.status === 'Approved'),
      rejected: scope.applications.filter((a) => a.status === 'Rejected'),
      all: scope.applications,
    }),
    [scope],
  )

  const rows = buckets[tab].filter(
    (a) =>
      (!q || `${a.ref} ${a.companyName} ${a.city} ${a.country}`.toLowerCase().includes(q.toLowerCase())) &&
      (!stageF || a.currentStageId === stageF) &&
      (!statusF || a.status === statusF),
  )

  return (
    <>
      <PageHeader
        title="Distributor Applications"
        description={can('application.view_all') ? 'All submitted distributor applications (read access) and any assigned to you.' : 'Applications assigned to you or to the stages you are responsible for.'}
        breadcrumbs={[{ label: 'Distributor Applications' }]}
      />
      <Card>
        <div className="px-5 pt-2">
          <Tabs<QueueTab>
            value={tab}
            onChange={(k) => setParams({ tab: k }, { replace: true })}
            items={[
              { key: 'action', label: 'Requiring my action', count: buckets.action.length },
              { key: 'progress', label: 'In progress', count: buckets.progress.length },
              { key: 'returned', label: 'Returned for correction', count: buckets.returned.length },
              { key: 'approved', label: 'Approved', count: buckets.approved.length },
              { key: 'rejected', label: 'Rejected', count: buckets.rejected.length },
              { key: 'all', label: 'All in my scope', count: buckets.all.length },
            ]}
          />
        </div>
        <FilterBar active={!!(q || stageF || statusF)} onReset={() => { setQ(''); setStageF(''); setStatusF('') }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search reference, company, city…" label="Search applications" />
          <FilterSelect label="Stage" value={stageF} onChange={setStageF} options={activeStages(state.onboardingWorkflow).map((s) => ({ value: s.id, label: s.name }))} />
          <FilterSelect label="Status" value={statusF} onChange={setStatusF} options={APPLICATION_STATUSES.filter((s) => s !== 'Draft').map((s) => ({ value: s, label: s }))} />
        </FilterBar>
        <DataTable<RegistrationApplication>
          rows={rows}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(`/app/applications/${a.id}`)}
          caption="Distributor applications"
          initialSort={{ key: 'updated', dir: 'desc' }}
          columns={[
            {
              key: 'ref',
              header: 'Reference',
              primary: true,
              sortValue: (a) => a.ref,
              cell: (a) => (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-medium">{a.ref}</span>
                  {actionIds.has(a.id) && <Badge tone="primary">Your action</Badge>}
                </span>
              ),
            },
            { key: 'company', header: 'Distributor', sortValue: (a) => a.companyName, cell: (a) => <span><span className="block font-medium">{a.companyName}</span><span className="text-xs text-muted">{a.city}, {a.country}</span></span> },
            { key: 'status', header: 'Status', sortValue: (a) => a.status, cell: (a) => <StatusBadge status={a.status} /> },
            { key: 'stage', header: 'Stage', hideOnMobile: true, cell: (a) => (['Approved', 'Rejected'].includes(a.status) ? '—' : stageById(state.onboardingWorkflow, a.currentStageId)?.name ?? '—') },
            { key: 'with', header: 'With', hideOnMobile: true, cell: (a) => (a.status === 'Returned for Correction' ? 'Applicant' : ['Approved', 'Rejected'].includes(a.status) ? '—' : lookups.user(a.assignedToUserId)?.name ?? 'Role queue') },
            {
              key: 'waiting',
              header: 'In stage',
              hideOnMobile: true,
              sortValue: (a) => (a.stageEnteredAt ? hoursBetween(a.stageEnteredAt) : 0),
              cell: (a) => {
                if (!IN_FLIGHT.includes(a.status) || !a.stageEnteredAt) return '—'
                const sla = stageById(state.onboardingWorkflow, a.currentStageId)?.slaHours ?? 48
                const h = hoursBetween(a.stageEnteredAt)
                return <span className={cn(h > sla && 'font-semibold text-danger-700')}>{relative(a.stageEnteredAt).replace(' ago', '')}{h > sla ? ' · overdue' : ''}</span>
              },
            },
            { key: 'updated', header: 'Updated', sortValue: (a) => a.updatedAt, cell: (a) => relative(a.updatedAt) },
          ]}
          empty={
            <EmptyState
              icon={tab === 'action' ? <Inbox className="size-5" /> : <FileCheck2 className="size-5" />}
              title={tab === 'action' ? 'Nothing needs your action' : 'No applications here'}
              description={tab === 'action' ? 'Applications assigned to your stage will appear here.' : 'Only applications within your access scope are listed.'}
            />
          }
        />
      </Card>
    </>
  )
}
