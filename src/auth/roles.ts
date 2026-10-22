/**
 * Built-in roles and their default permission sets (conceptually `roles` + `role_permissions`).
 * Administrators can edit these grants and add custom roles at runtime in the prototype.
 * Mapping to the requested role categories:
 *   System Administrator  → admin
 *   Requester / Applicant → applicant (and distributor once approved)
 *   Initial Reviewer      → sales_coordinator
 *   Departmental Approver → territory_manager (assigned by territory)
 *   Final Approver        → general_manager
 *   Read-only / Audit     → auditor
 */
import type { Role } from '@/types/domain'
import { PERMISSIONS } from './permissions'

export const ROLE_IDS = {
  admin: 'admin',
  applicant: 'applicant',
  distributor: 'distributor',
  salesCoordinator: 'sales_coordinator',
  territoryManager: 'territory_manager',
  regionalManager: 'regional_manager',
  generalManager: 'general_manager',
  finance: 'finance',
  logistics: 'logistics',
  auditor: 'auditor',
} as const

/** Role whose critical administration permissions are locked (prevents lock-out). */
export const PROTECTED_ROLE_ID = ROLE_IDS.admin

const WORKSPACE = ['dashboard.view', 'task.view', 'notification.view']

export const defaultRoles: Role[] = [
  {
    id: ROLE_IDS.admin,
    name: 'System Administrator',
    description: 'Manages users, roles, permissions, territories, workflow configuration and integrations.',
    system: true,
    audience: 'internal',
    permissions: [
      ...WORKSPACE,
      'application.view_all', 'application.view_internal',
      'distributor.view_all', 'distributor.manage',
      'catalog.view', 'order.view_all', 'order.create', 'order.create_on_behalf', 'order.cancel', 'order.comment', 'order.approval_monitor',
      'invoice.view', 'payment.view', 'shipment.view', 'shipment.update', 'collection.view', 'document.view', 'document.upload',
      'email.view', 'email.send', 'followup.manage',
      'user.view', 'user.manage', 'role.view', 'role.manage', 'permission.manage',
      'territory.view', 'territory.manage', 'workflow.view', 'workflow.manage', 'integration.view', 'integration.retry', 'audit.view',
    ],
  },
  {
    id: ROLE_IDS.applicant,
    name: 'Distributor Applicant',
    description: 'Prospective distributor: submits and tracks its own application, responds to corrections.',
    system: true,
    audience: 'external',
    permissions: ['dashboard.view', 'notification.view', 'task.view', 'application.create', 'application.view_own', 'application.edit_own', 'application.resubmit'],
  },
  {
    id: ROLE_IDS.distributor,
    name: 'Distributor',
    description: 'Approved distributor: orders, invoices, payments and shipments for its own account.',
    system: true,
    audience: 'external',
    permissions: [
      ...WORKSPACE, 'application.view_own', 'distributor.view_own', 'catalog.view',
      'order.view_own', 'order.create', 'order.cancel', 'order.comment',
      'invoice.view', 'payment.view', 'payment.upload_receipt', 'shipment.view', 'collection.view', 'document.view', 'document.upload',
      'email.view', 'email.send',
    ],
  },
  {
    id: ROLE_IDS.salesCoordinator,
    name: 'Sales Coordinator (Initial Reviewer)',
    description: 'Initial review of distributor applications in assigned regions; creates requests on behalf of distributors.',
    system: true,
    audience: 'internal',
    permissions: [
      ...WORKSPACE,
      'application.view_assigned', 'application.view_internal', 'application.review', 'application.return_to_requester', 'application.request_clarification',
      'distributor.view_all', 'distributor.manage', 'catalog.view',
      'order.view_all', 'order.create', 'order.create_on_behalf', 'order.cancel', 'order.comment', 'order.approval_monitor',
      'invoice.view', 'payment.view', 'payment.upload_receipt', 'shipment.view', 'collection.view', 'document.view', 'document.upload',
      'email.view', 'email.send', 'followup.manage',
    ],
  },
  {
    id: ROLE_IDS.territoryManager,
    name: 'Territory Manager (Departmental Approver)',
    description: 'Commercial approval of applications and first-level order approval for assigned territories.',
    system: true,
    audience: 'internal',
    permissions: [
      ...WORKSPACE,
      'application.view_assigned', 'application.view_internal', 'application.approve', 'application.reject', 'application.return_to_requester',
      'application.request_clarification', 'application.return_to_previous_approver',
      'distributor.view_assigned', 'distributor.manage', 'catalog.view',
      'order.view_assigned', 'order.comment', 'order.approve', 'order.reject', 'order.return_to_requester', 'order.return_to_previous_approver',
      'shipment.view', 'document.view', 'email.view', 'email.send', 'followup.manage',
    ],
  },
  {
    id: ROLE_IDS.regionalManager,
    name: 'Regional Manager',
    description: 'Second-level order approval for a region.',
    system: true,
    audience: 'internal',
    permissions: [
      ...WORKSPACE, 'distributor.view_assigned', 'distributor.manage', 'catalog.view',
      'order.view_assigned', 'order.comment', 'order.approve', 'order.reject', 'order.return_to_requester', 'order.return_to_previous_approver',
      'invoice.view', 'shipment.view', 'document.view', 'email.view', 'email.send', 'followup.manage',
    ],
  },
  {
    id: ROLE_IDS.generalManager,
    name: 'General Manager (Final Approver)',
    description: 'Final approval of distributor applications and strategic orders.',
    system: true,
    audience: 'internal',
    permissions: [
      ...WORKSPACE,
      'application.view_assigned', 'application.view_internal', 'application.approve', 'application.reject', 'application.return_to_requester',
      'application.return_to_previous_approver',
      'distributor.view_all', 'distributor.manage', 'catalog.view',
      'order.view_all', 'order.comment', 'order.approve', 'order.reject', 'order.return_to_requester', 'order.return_to_previous_approver',
      'invoice.view', 'shipment.view', 'document.view', 'email.view', 'email.send', 'followup.manage', 'territory.view',
    ],
  },
  {
    id: ROLE_IDS.finance,
    name: 'Finance Officer',
    description: 'Issues proforma invoices, verifies payments and (when enabled) performs the credit check on distributor applications.',
    system: true,
    audience: 'internal',
    permissions: [
      ...WORKSPACE, 'distributor.view_all', 'order.view_all', 'order.comment', 'invoice.view', 'invoice.issue', 'payment.view', 'payment.verify',
      // Used only when the optional “Credit & compliance check” onboarding stage is active (record access is limited to assigned stages).
      'application.view_assigned', 'application.view_internal', 'application.approve', 'application.reject', 'application.return_to_requester',
      'application.request_clarification', 'application.return_to_previous_approver',
      'shipment.view', 'document.view', 'email.view', 'email.send', 'followup.manage', 'integration.view', 'integration.retry',
    ],
  },
  {
    id: ROLE_IDS.logistics,
    name: 'Logistics Coordinator',
    description: 'Warehouse preparation, shipping documents and collection.',
    system: true,
    audience: 'internal',
    permissions: [...WORKSPACE, 'order.view_all', 'order.comment', 'shipment.view', 'shipment.update', 'collection.view', 'document.view', 'document.upload', 'email.view', 'email.send', 'followup.manage'],
  },
  {
    id: ROLE_IDS.auditor,
    name: 'Read-only Auditor',
    description: 'Views records, decisions and audit history. Cannot modify records or take workflow actions.',
    system: true,
    audience: 'internal',
    permissions: [
      'dashboard.view', 'notification.view',
      'application.view_all', 'application.view_internal', 'distributor.view_all', 'order.view_all', 'order.approval_monitor',
      'invoice.view', 'payment.view', 'shipment.view', 'document.view', 'email.view',
      'user.view', 'role.view', 'workflow.view', 'territory.view', 'audit.view',
    ],
  },
]

// Sanity check during development: every granted permission must exist in the catalog.
if (import.meta.env.DEV) {
  const known = new Set(PERMISSIONS.map((x) => x.id))
  for (const r of defaultRoles) for (const perm of r.permissions) if (!known.has(perm)) console.warn(`Unknown permission ${perm} on role ${r.id}`)
}
