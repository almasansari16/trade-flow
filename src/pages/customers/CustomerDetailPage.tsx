import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Ban, ChevronDown, ClipboardList, Eye, FileText, Mail, MapPin, Pause, Phone, Play, Plus, UserRound, Users } from 'lucide-react'
import { requestTotal, useLookups, useStore } from '@/app/store'
import { useScope } from '@/hooks/useScope'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar, EmptyState, KeyValue, Notice } from '@/components/ui/misc'
import { DataTable, type Column } from '@/components/data-display/DataTable'
import { DocumentPreview } from '@/components/data-display/DocumentPreview'
import { Popover, MenuItem } from '@/components/ui/Menu'
import { Dialog } from '@/components/ui/Dialog'
import { TextareaField } from '@/components/forms/Field'
import { useToast } from '@/components/ui/Toast'
import { brands } from '@/data/catalog'
import { date, fileSize, money, relative } from '@/utils/format'
import type { CustomerStatus, DocumentRecord, SalesOrderRequest } from '@/types/domain'

type TabKey = 'overview' | 'requests' | 'documents' | 'communication' | 'finance'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { state, can, canAny, setCustomerStatus } = useStore()
  const scope = useScope()
  const lookups = useLookups()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<TabKey>('overview')
  const [statusDialog, setStatusDialog] = useState<CustomerStatus | null>(null)
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<DocumentRecord | null>(null)

  const customer = scope.customers.find((c) => c.id === id)
  if (!customer)
    return (
      <div className="card">
        <EmptyState icon={<Users className="size-5" />} title="Distributor not available" description="It does not exist or is outside your access scope." action={<ButtonLink to="/app/distributors" variant="secondary">Back to distributors</ButtonLink>} />
      </div>
    )

  const requests = state.requests.filter((r) => r.customerId === customer.id)
  const docs = state.documents.filter((d) => d.customerId === customer.id)
  const regDocs = docs.filter((d) => d.linkedTo.kind === 'customer')
  const threads = state.threads.filter((t) => t.customerId === customer.id)
  const invoices = state.invoices.filter((i) => i.customerId === customer.id)
  const territory = lookups.territory(customer.territoryId)
  const expired = regDocs.filter((d) => d.status === 'Expired')
  const confirmedValue = requests.filter((r) => !['Draft', 'Rejected', 'Cancelled', 'In Approval', 'Changes Requested'].includes(r.status)).reduce((s, r) => s + requestTotal(r), 0)
  const outstanding = invoices.filter((i) => ['Issued', 'Receipt Uploaded'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const canManage = can('distributor.manage')

  const reqColumns: Column<SalesOrderRequest>[] = [
    { key: 'ref', header: 'Request', primary: true, sortValue: (r) => r.ref, cell: (r) => <span className="font-mono text-[12px] font-medium">{r.ref}</span> },
    { key: 'date', header: 'Created', sortValue: (r) => r.createdAt, cell: (r) => date(r.createdAt) },
    { key: 'lines', header: 'Lines', align: 'right', cell: (r) => r.lines.length },
    { key: 'value', header: 'Value', align: 'right', sortValue: (r) => requestTotal(r), cell: (r) => <span className="font-medium tabular">{money(requestTotal(r), r.currency)}</span> },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Distributors', to: '/app/distributors' }, { label: customer.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={customer.name} size="lg" />
            <span>
              {customer.name}
              <span className="block text-[13px] font-normal text-muted">{customer.code} · {customer.legalName}</span>
            </span>
          </span>
        }
        meta={<><StatusBadge status={customer.status} /><Badge tone={customer.tier === 'Platinum' ? 'dark' : 'neutral'}>{customer.tier}</Badge></>}
        actions={
          <>
            <Button variant="secondary" icon={<Mail className="size-4" />} onClick={() => navigate(`/app/email?compose=${customer.id}`)}>Email</Button>
            {canManage && (
              <Popover
                trigger={(p) => (
                  <Button variant="secondary" onClick={p.toggle} aria-expanded={p['aria-expanded']} iconRight={<ChevronDown className="size-4" />}>Review actions</Button>
                )}
              >
                {(close) => (
                  <div role="menu">
                    {customer.status !== 'Active' && <MenuItem icon={<Play className="size-4" />} onClick={() => { close(); setStatusDialog('Active') }} description="Allow new order requests">Reactivate account</MenuItem>}
                    {customer.status !== 'On Hold' && <MenuItem icon={<Pause className="size-4" />} onClick={() => { close(); setStatusDialog('On Hold') }} description="Pause new orders pending review">Put on hold</MenuItem>}
                    {customer.status !== 'Blocked' && <MenuItem danger icon={<Ban className="size-4" />} onClick={() => { close(); setStatusDialog('Blocked') }} description="Block all activity">Block account</MenuItem>}
                  </div>
                )}
              </Popover>
            )}
            {canAny('order.create_on_behalf') && customer.status === 'Active' && (
              <ButtonLink to={`/app/requests/new?customer=${customer.id}`} icon={<Plus className="size-4" />}>New request</ButtonLink>
            )}
          </>
        }
      />

      {expired.length > 0 && (
        <Notice tone="danger" icon={<AlertTriangle className="size-4" />} className="mb-6" title="Expired registration document" action={<Button size="sm" variant="secondary" onClick={() => setTab('documents')}>View documents</Button>}>
          {expired.map((d) => d.name).join(', ')} expired {relative(expired[0]!.expiresAt)}. New requests may be held until renewed.
        </Notice>
      )}
      {customer.status === 'On Hold' && <Notice tone="warning" className="mb-6" title="Account on hold">New order requests are paused for this distributor.</Notice>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Confirmed order value', money(confirmedValue, customer.currency, { compact: true })],
          ['Open requests', String(requests.filter((r) => ['In Approval', 'Changes Requested'].includes(r.status)).length)],
          ['Outstanding proforma', money(outstanding, customer.currency, { compact: true })],
          ['Credit limit', money(customer.creditLimit, 'USD', { compact: true })],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <p className="text-xs text-muted">{l}</p>
            <p className="mt-1 text-lg font-semibold tabular">{v}</p>
          </div>
        ))}
      </div>

      <Card>
        <Tabs
          className="px-3"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'overview', label: 'Profile' },
            { key: 'requests', label: 'Requests', count: requests.length },
            { key: 'documents', label: 'Documents', count: docs.length },
            { key: 'communication', label: 'Communication', count: threads.length },
            { key: 'finance', label: 'Invoices', count: invoices.length },
          ]}
        />

        {tab === 'overview' && (
          <div className="grid gap-0 lg:grid-cols-3">
            <div className="space-y-6 p-5 lg:col-span-2 lg:border-r lg:border-line">
              <KeyValue
                cols={3}
                items={[
                  { label: 'Commercial registration', value: <span className="font-mono">{customer.crNumber}</span> },
                  { label: 'Tax number', value: <span className="font-mono">{customer.taxNumber}</span> },
                  { label: 'Invoice currency', value: customer.currency },
                  { label: 'Payment terms', value: customer.paymentTerms },
                  { label: 'Distributor since', value: date(customer.customerSince) },
                  { label: 'ERP reference', value: <span className="inline-flex items-center gap-1.5">{customer.externalRef ?? 'Not synchronised'}</span> },
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {[['Billing address', customer.billingAddress], ['Delivery address', customer.deliveryAddress]].map(([l, a]) => {
                  const ad = a as typeof customer.billingAddress
                  return (
                    <div key={l as string} className="rounded-xl border border-line p-4">
                      <p className="eyebrow flex items-center gap-1.5"><MapPin className="size-3.5" />{l as string}</p>
                      <p className="mt-2 text-[13px]">{ad.line1}</p>
                      <p className="text-[13px] text-muted">{[ad.city, ad.postalCode, ad.country].filter(Boolean).join(', ')}</p>
                    </div>
                  )
                })}
              </div>
              <div>
                <p className="eyebrow mb-2">Contacts</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {customer.contacts.map((c) => (
                    <li key={c.id} className="flex gap-3 rounded-xl border border-line p-3.5">
                      <Avatar name={c.name} size="sm" />
                      <div className="min-w-0 text-[13px]">
                        <p className="font-medium">{c.name} {c.primary && <Badge tone="primary" className="ml-1">Primary</Badge>}</p>
                        <p className="text-xs text-muted">{c.role}</p>
                        <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs"><Mail className="size-3 text-muted" />{c.email}</p>
                        <p className="flex items-center gap-1.5 text-xs"><Phone className="size-3 text-muted" />{c.phone}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-6 p-5">
              <div>
                <p className="eyebrow mb-2">Territory assignment</p>
                <div className="rounded-xl bg-canvas p-4 text-[13px]">
                  <p className="font-semibold">{territory?.name}</p>
                  <p className="text-xs text-muted">{lookups.region(territory?.regionId)?.name} region</p>
                  <div className="mt-3 space-y-2">
                    {[
                      ['Territory manager', lookups.user(territory?.managerId)?.name],
                      ['Regional manager', lookups.user(lookups.region(territory?.regionId)?.managerId)?.name],
                      ['Account manager', lookups.user(customer.accountManagerId)?.name],
                    ].map(([l, n]) => (
                      <p key={l} className="flex items-center gap-2"><UserRound className="size-3.5 text-muted" /><span className="text-muted">{l}:</span> <span className="font-medium">{n}</span></p>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="eyebrow mb-2">Authorised brands</p>
                <div className="flex flex-wrap gap-2">
                  {customer.brandIds.map((b) => {
                    const br = brands.find((x) => x.id === b)!
                    return (
                      <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium">
                        <span className="size-2 rounded-full" style={{ background: `hsl(${br.hue} 55% 55%)` }} />
                        {br.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <DataTable
            rows={requests}
            columns={reqColumns}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/app/requests/${r.id}`)}
            initialSort={{ key: 'date', dir: 'desc' }}
            empty={<EmptyState icon={<ClipboardList className="size-5" />} title="No requests yet" />}
          />
        )}

        {tab === 'documents' && (
          <ul className="divide-y divide-line">
            {docs.length === 0 && <li><EmptyState icon={<FileText className="size-5" />} title="No documents" /></li>}
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary"><FileText className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{d.name}</span>
                  <span className="block text-xs text-muted">{d.type} · {fileSize(d.sizeKb)} · {date(d.uploadedAt)}{d.expiresAt && ` · expires ${date(d.expiresAt)}`}</span>
                </span>
                <StatusBadge status={d.status} />
                <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} onClick={() => setPreview(d)}>Preview</Button>
              </li>
            ))}
          </ul>
        )}

        {tab === 'communication' && (
          <ul className="divide-y divide-line">
            {threads.length === 0 && <li><EmptyState icon={<Mail className="size-5" />} title="No conversations" action={<Button onClick={() => navigate(`/app/email?compose=${customer.id}`)}>Compose email</Button>} /></li>}
            {threads.map((t) => (
              <li key={t.id}>
                <Link to={`/app/email?thread=${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-canvas">
                  <Mail className="size-4 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{t.subject}</span>
                    <span className="block text-xs text-muted">{t.messages.length} message(s) · last {relative(t.messages.at(-1)?.sentAt)}</span>
                  </span>
                  {t.followUp.status !== 'None' && <StatusBadge status={t.followUp.status} />}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {tab === 'finance' && (
          <ul className="divide-y divide-line">
            {invoices.length === 0 && <li><EmptyState icon={<FileText className="size-5" />} title="No proforma invoices" /></li>}
            {invoices.map((i) => (
              <li key={i.id}>
                <Link to={`/app/invoices/${i.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13px] font-medium">{i.number}</span>
                    <span className="block text-xs text-muted">Issued {date(i.issuedAt)} · {lookups.request(i.requestId)?.ref}</span>
                  </span>
                  <span className="text-[13px] font-semibold tabular">{money(i.total, i.currency)}</span>
                  <StatusBadge status={i.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog
        open={!!statusDialog}
        onClose={() => setStatusDialog(null)}
        title={statusDialog === 'Active' ? 'Reactivate account' : statusDialog === 'On Hold' ? 'Put account on hold' : 'Block account'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusDialog(null)}>Cancel</Button>
            <Button
              variant={statusDialog === 'Blocked' ? 'danger' : 'primary'}
              disabled={statusDialog !== 'Active' && reason.trim().length < 5}
              onClick={() => {
                setCustomerStatus(customer.id, statusDialog!, reason)
                toast.success(`Account status: ${statusDialog}`, 'Updated in the prototype only.')
                setStatusDialog(null)
                setReason('')
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <TextareaField label="Reason" required={statusDialog !== 'Active'} hint="Kept with the account history (demo)." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
      </Dialog>
      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </>
  )
}
