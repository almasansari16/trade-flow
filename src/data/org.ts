import type { DemoUser, Region, Territory } from '@/types/domain'
import { ago } from '@/utils/time'

const I = 'internal' as const
const X = 'external' as const

/**
 * Seeded users. `roleIds` = user_roles; territoryIds / regionId / reviewRegionIds / customerId = user_assignments.
 * Two users can share a role yet see different records (e.g. Priya vs Hassan review different regions).
 */
export const users: DemoUser[] = [
  // External — distributors and applicants
  { id: 'u-dist', name: 'Omar Haddad', email: 'omar.haddad@gulfhorizon.example', title: 'Purchasing Director, Gulf Horizon Trading', roleIds: ['distributor'], kind: X, customerId: 'c-001', active: true, lastActiveAt: ago(0, 1) },
  { id: 'u-jonas', name: 'Jonas Becker', email: 'jonas@nordlicht.example', title: 'Einkaufsleiter, Nordlicht Parfümerie', roleIds: ['distributor'], kind: X, customerId: 'c-011', active: true, lastActiveAt: ago(3) },
  { id: 'u-app1', name: 'Huda Al-Ghamdi', email: 'huda@desertbloom.example', title: 'Chief Executive, Desert Bloom Cosmetics', roleIds: ['applicant'], kind: X, active: true, lastActiveAt: ago(1) },
  { id: 'u-app2', name: 'Neema Mushi', email: 'neema@lagoonbeauty.example', title: 'Procurement Lead, Lagoon Beauty', roleIds: ['applicant'], kind: X, active: true, lastActiveAt: ago(2) },
  { id: 'u-app3', name: 'Tom Ashworth', email: 'tom@auroratrade.example', title: 'Founder, Aurora Trade Co', roleIds: ['applicant'], kind: X, active: true, lastActiveAt: ago(0, 6) },
  { id: 'u-app4', name: 'Dilshan Perera', email: 'dilshan@lankaaroma.example', title: 'Director, Lanka Aroma', roleIds: ['applicant'], kind: X, active: true, lastActiveAt: ago(15) },
  { id: 'u-app5', name: 'Rafael Costa', email: 'rafael@atlanticscents.example', title: 'Managing Director, Atlantic Scents', roleIds: ['applicant'], kind: X, active: true, lastActiveAt: ago(0, 9) },
  { id: 'u-app6', name: 'Ali Al-Khalifa', email: 'ali@bahrainfragrance.example', title: 'Owner, Bahrain Fragrance Hub', roleIds: ['applicant'], kind: X, active: true, lastActiveAt: ago(0, 20) },
  { id: 'u-app7', name: 'Siti Rahman', email: 'siti@klessence.example', title: 'Director, KL Essence Sdn Bhd', roleIds: ['applicant'], kind: X, active: true, lastActiveAt: ago(2) },
  // Internal
  { id: 'u-sc', name: 'Priya Nair', email: 'priya.nair@tradeflow.example', title: 'Sales Coordinator — Middle East & Africa', roleIds: ['sales_coordinator'], kind: I, department: 'Sales Operations', reviewRegionIds: ['r-me', 'r-af'], active: true, lastActiveAt: ago(0, 0.2) },
  { id: 'u-sc2', name: 'Hassan Javed', email: 'hassan.javed@tradeflow.example', title: 'Sales Coordinator — Europe & Asia Pacific', roleIds: ['sales_coordinator'], kind: I, department: 'Sales Operations', reviewRegionIds: ['r-eu', 'r-apac'], active: true, lastActiveAt: ago(0, 3) },
  { id: 'u-tm1', name: 'Daniel Okafor', email: 'daniel.okafor@tradeflow.example', title: 'Territory Manager — Gulf', roleIds: ['territory_manager'], kind: I, department: 'Commercial', territoryIds: ['t-uae', 't-gcc'], active: true, lastActiveAt: ago(0, 2) },
  { id: 'u-tm2', name: 'Faisal Rahman', email: 'faisal.rahman@tradeflow.example', title: 'Territory Manager — Saudi Arabia', roleIds: ['territory_manager'], kind: I, department: 'Commercial', territoryIds: ['t-ksa'], active: true, lastActiveAt: ago(0, 5) },
  { id: 'u-tm3', name: 'Sofia Lindqvist', email: 'sofia.lindqvist@tradeflow.example', title: 'Territory Manager — UK & Western Europe', roleIds: ['territory_manager'], kind: I, department: 'Commercial', territoryIds: ['t-uk', 't-weu'], active: true, lastActiveAt: ago(1) },
  { id: 'u-tm4', name: 'Ken Tanaka', email: 'ken.tanaka@tradeflow.example', title: 'Territory Manager — Asia', roleIds: ['territory_manager'], kind: I, department: 'Commercial', territoryIds: ['t-sea', 't-sa'], active: true, lastActiveAt: ago(0, 7) },
  { id: 'u-tm5', name: 'Amara Mensah', email: 'amara.mensah@tradeflow.example', title: 'Territory Manager — East Africa', roleIds: ['territory_manager'], kind: I, department: 'Commercial', territoryIds: ['t-eaf'], active: true, lastActiveAt: ago(2) },
  { id: 'u-rm1', name: 'Layla Mansour', email: 'layla.mansour@tradeflow.example', title: 'Regional Manager — Middle East', roleIds: ['regional_manager'], kind: I, department: 'Commercial', regionId: 'r-me', active: true, lastActiveAt: ago(0, 3) },
  { id: 'u-rm2', name: 'Henrik Bauer', email: 'henrik.bauer@tradeflow.example', title: 'Regional Manager — Europe', roleIds: ['regional_manager'], kind: I, department: 'Commercial', regionId: 'r-eu', active: true, lastActiveAt: ago(0, 9) },
  { id: 'u-rm3', name: 'Mei Lin Wong', email: 'meilin.wong@tradeflow.example', title: 'Regional Manager — Asia Pacific', roleIds: ['regional_manager'], kind: I, department: 'Commercial', regionId: 'r-apac', active: true, lastActiveAt: ago(1, 2) },
  { id: 'u-rm4', name: 'Kwame Asante', email: 'kwame.asante@tradeflow.example', title: 'Regional Manager — Africa', roleIds: ['regional_manager'], kind: I, department: 'Commercial', regionId: 'r-af', active: false, lastActiveAt: ago(16) },
  { id: 'u-gm', name: 'Marcus Chen', email: 'marcus.chen@tradeflow.example', title: 'General Manager', roleIds: ['general_manager'], kind: I, department: 'Executive', active: true, lastActiveAt: ago(0, 4) },
  { id: 'u-fin', name: 'Aisha Siddiqui', email: 'aisha.siddiqui@tradeflow.example', title: 'Finance Officer', roleIds: ['finance'], kind: I, department: 'Finance', active: true, lastActiveAt: ago(0, 1) },
  { id: 'u-log', name: 'Carlos Mendes', email: 'carlos.mendes@tradeflow.example', title: 'Logistics Coordinator', roleIds: ['logistics'], kind: I, department: 'Logistics', active: true, lastActiveAt: ago(0, 2) },
  { id: 'u-audit', name: 'Nadia Rahim', email: 'nadia.rahim@tradeflow.example', title: 'Internal Auditor', roleIds: ['auditor'], kind: I, department: 'Internal Audit', active: true, lastActiveAt: ago(1, 4) },
  { id: 'u-admin', name: 'Elena Petrova', email: 'elena.petrova@tradeflow.example', title: 'Platform Administrator', roleIds: ['admin'], kind: I, department: 'IT', active: true, lastActiveAt: ago(0, 6) },
  { id: 'u-system', name: 'TradeFlow Workflow', email: 'workflow@tradeflow.example', title: 'System', roleIds: [], kind: I, active: true, lastActiveAt: ago(0) },
]

/** Accounts offered on the prototype sign-in page (all use the demo password). */
export const DEMO_ACCOUNTS: { userId: string; label: string }[] = [
  { userId: 'u-dist', label: 'Distributor' },
  { userId: 'u-app1', label: 'Applicant (under review)' },
  { userId: 'u-app2', label: 'Applicant (returned for correction)' },
  { userId: 'u-sc', label: 'Initial Reviewer — ME & Africa' },
  { userId: 'u-sc2', label: 'Initial Reviewer — Europe & APAC' },
  { userId: 'u-tm1', label: 'Departmental Approver — Gulf' },
  { userId: 'u-tm2', label: 'Departmental Approver — Saudi Arabia' },
  { userId: 'u-rm1', label: 'Regional Manager' },
  { userId: 'u-gm', label: 'Final Approver' },
  { userId: 'u-fin', label: 'Finance Officer' },
  { userId: 'u-log', label: 'Logistics Coordinator' },
  { userId: 'u-audit', label: 'Read-only Auditor' },
  { userId: 'u-admin', label: 'System Administrator' },
]

export const regions: Region[] = [
  { id: 'r-me', name: 'Middle East', managerId: 'u-rm1' },
  { id: 'r-eu', name: 'Europe', managerId: 'u-rm2' },
  { id: 'r-apac', name: 'Asia Pacific', managerId: 'u-rm3' },
  { id: 'r-af', name: 'Africa', managerId: 'u-rm4' },
]

const ALL_BRANDS = ['b-velour', 'b-oud', 'b-noire', 'b-cedar', 'b-aurelle']

export const territories: Territory[] = [
  { id: 't-uae', name: 'UAE & Oman', regionId: 'r-me', countries: ['United Arab Emirates', 'Oman'], managerId: 'u-tm1', defaultCurrency: 'AED', visibleBrandIds: ALL_BRANDS },
  { id: 't-gcc', name: 'Qatar, Bahrain & Kuwait', regionId: 'r-me', countries: ['Qatar', 'Bahrain', 'Kuwait'], managerId: 'u-tm1', defaultCurrency: 'QAR', visibleBrandIds: ALL_BRANDS },
  { id: 't-ksa', name: 'Saudi Arabia', regionId: 'r-me', countries: ['Saudi Arabia'], managerId: 'u-tm2', defaultCurrency: 'SAR', visibleBrandIds: ALL_BRANDS },
  { id: 't-uk', name: 'UK & Ireland', regionId: 'r-eu', countries: ['United Kingdom', 'Ireland'], managerId: 'u-tm3', defaultCurrency: 'GBP', visibleBrandIds: ['b-velour', 'b-noire', 'b-cedar', 'b-aurelle'] },
  { id: 't-weu', name: 'Western Europe', regionId: 'r-eu', countries: ['France', 'Germany', 'Belgium', 'Netherlands'], managerId: 'u-tm3', defaultCurrency: 'EUR', visibleBrandIds: ['b-velour', 'b-noire', 'b-cedar', 'b-aurelle'] },
  { id: 't-sea', name: 'Southeast Asia', regionId: 'r-apac', countries: ['Singapore', 'Malaysia'], managerId: 'u-tm4', defaultCurrency: 'SGD', visibleBrandIds: ALL_BRANDS },
  { id: 't-sa', name: 'South Asia', regionId: 'r-apac', countries: ['Pakistan', 'India', 'Sri Lanka'], managerId: 'u-tm4', defaultCurrency: 'USD', visibleBrandIds: ['b-velour', 'b-oud', 'b-aurelle'] },
  { id: 't-eaf', name: 'East Africa', regionId: 'r-af', countries: ['Kenya', 'Tanzania'], managerId: 'u-tm5', defaultCurrency: 'USD', visibleBrandIds: ['b-velour', 'b-oud', 'b-cedar'] },
]

export const COUNTRIES = territories.flatMap((t) => t.countries.map((c) => ({ country: c, territoryId: t.id }))).sort((a, b) => a.country.localeCompare(b.country))

export const WAREHOUSES = ['Jebel Ali DC — Dubai', 'Rotterdam DC — Netherlands', 'Tuas DC — Singapore']
