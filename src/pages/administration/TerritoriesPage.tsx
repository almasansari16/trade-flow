import { Globe2, MapPinned, UserRound } from 'lucide-react'
import { useLookups, useStore } from '@/app/store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { brands } from '@/data/catalog'
import { regions } from '@/data/org'
import { cn } from '@/utils/cn'

export default function TerritoriesPage() {
  const { state, can, updateTerritory } = useStore()
  const lookups = useLookups()
  const toast = useToast()
  const editable = can('territory.manage')
  const tms = state.users.filter((u) => u.active && u.roleIds.includes('territory_manager'))

  return (
    <>
      <PageHeader
        title="Territories and regions"
        description="Territory managers route first-level approvals; brand visibility controls what distributors can order."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Territories and Regions' }]}
        meta={!editable && <Badge tone="neutral">Read-only access</Badge>}
      />
      <div className="space-y-6">
        {regions.map((r) => {
          const ts = state.territories.filter((t) => t.regionId === r.id)
          return (
            <Card key={r.id}>
              <CardHeader
                icon={<Globe2 className="size-5" />}
                title={`${r.name} region`}
                description={<span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" />Regional manager: {lookups.user(r.managerId)?.name}{!lookups.user(r.managerId)?.active && ' (inactive)'}</span>}
                actions={<Badge tone="neutral">{ts.length} territories</Badge>}
              />
              <ul className="divide-y divide-line">
                {ts.map((t) => {
                  const customers = state.customers.filter((c) => c.territoryId === t.id)
                  return (
                    <li key={t.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.1fr_1fr_1.6fr]">
                      <div>
                        <p className="flex items-center gap-2 text-[13px] font-semibold"><MapPinned className="size-4 text-primary" />{t.name}</p>
                        <p className="mt-1 text-xs text-muted">{t.countries.join(', ')}</p>
                        <p className="mt-1 text-xs text-muted">{customers.length} customer(s) · default currency {t.defaultCurrency}</p>
                      </div>
                      <div>
                        <label className="eyebrow mb-1.5 block" htmlFor={`tm-${t.id}`}>Territory manager</label>
                        <select
                          id={`tm-${t.id}`}
                          className="input h-9"
                          disabled={!editable}
                          value={t.managerId}
                          onChange={(e) => {
                            updateTerritory(t.id, { managerId: e.target.value })
                            toast.success(`${t.name} reassigned`, `New requests route to ${lookups.user(e.target.value)?.name}.`)
                          }}
                        >
                          {tms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="eyebrow mb-1.5">Brand visibility</p>
                        <div className="flex flex-wrap gap-1.5">
                          {brands.map((b) => {
                            const on = t.visibleBrandIds.includes(b.id)
                            return (
                              <button
                                key={b.id}
                                type="button"
                                disabled={!editable}
                                aria-pressed={on}
                                onClick={() => {
                                  updateTerritory(t.id, { visibleBrandIds: on ? t.visibleBrandIds.filter((x) => x !== b.id) : [...t.visibleBrandIds, b.id] })
                                  toast.info(`${b.name} ${on ? 'hidden in' : 'visible in'} ${t.name}`)
                                }}
                                className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default', on ? 'border-primary/40 bg-primary-50 text-primary-700' : 'border-line text-muted line-through decoration-muted/50', editable && 'hover:border-primary')}
                              >
                                <span className="size-2 rounded-full" style={{ background: on ? `hsl(${b.hue} 55% 55%)` : '#cbd5e1' }} />
                                {b.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
      </div>
    </>
  )
}
