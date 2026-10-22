/**
 * Permission catalog (conceptually the `permissions` table).
 * Every navigation item, route guard, dashboard widget and action button in the
 * UI is gated by one of these identifiers — never by a role name.
 */
export interface PermissionDef {
  id: string
  module: PermissionModule
  /** Column used by the authorization matrix. */
  action: 'View' | 'Create' | 'Edit' | 'Review' | 'Approve' | 'Reject' | 'Return' | 'Manage'
  label: string
  description: string
  /** Critical permissions cannot be removed from the protected System Administrator role. */
  critical?: boolean
}

export const MODULES = [
  'Workspace',
  'Distributor applications',
  'Distributors',
  'Product catalog',
  'Sales orders',
  'Finance',
  'Fulfilment',
  'Communication',
  'Administration',
] as const
export type PermissionModule = (typeof MODULES)[number]

const p = (id: string, module: PermissionModule, action: PermissionDef['action'], label: string, description: string, critical?: boolean): PermissionDef => ({ id, module, action, label, description, critical })

export const PERMISSIONS: PermissionDef[] = [
  // Workspace
  p('dashboard.view', 'Workspace', 'View', 'View dashboard', 'Open the overview dashboard.'),
  p('task.view', 'Workspace', 'View', 'View my tasks', 'See work items generated for the user.'),
  p('notification.view', 'Workspace', 'View', 'View notifications', 'Receive and read in-app notifications.'),

  // Distributor applications (onboarding workflow)
  p('application.create', 'Distributor applications', 'Create', 'Create application', 'Register and submit a distributor application.'),
  p('application.view_own', 'Distributor applications', 'View', 'View own applications', 'See applications the user submitted.'),
  p('application.edit_own', 'Distributor applications', 'Edit', 'Edit own application', 'Edit a draft or the sections re-opened for correction.'),
  p('application.resubmit', 'Distributor applications', 'Edit', 'Resubmit application', 'Resubmit after correction or answer a clarification.'),
  p('application.view_assigned', 'Distributor applications', 'View', 'View assigned applications', 'See applications assigned to the user or to stages the user is responsible for.'),
  p('application.view_all', 'Distributor applications', 'View', 'View all applications', 'See every submitted application (read access).'),
  p('application.view_internal', 'Distributor applications', 'View', 'View internal remarks', 'See reviewer-only remarks in workflow history.'),
  p('application.review', 'Distributor applications', 'Review', 'Review & forward', 'Act on review-type stages (record findings, forward to the next stage).'),
  p('application.approve', 'Distributor applications', 'Approve', 'Approve application', 'Approve at approval-type stages.'),
  p('application.reject', 'Distributor applications', 'Reject', 'Reject application', 'Reject an application with a mandatory reason.'),
  p('application.return_to_requester', 'Distributor applications', 'Return', 'Return to requester', 'Return an application to the applicant for correction.'),
  p('application.request_clarification', 'Distributor applications', 'Return', 'Request clarification', 'Ask the applicant a question without re-opening fields.'),
  p('application.return_to_previous_approver', 'Distributor applications', 'Return', 'Return to previous approver', 'Send an application back to an earlier approval stage.'),

  // Distributors (accounts)
  p('distributor.view_own', 'Distributors', 'View', 'View own distributor account', 'See the user’s own distributor company.'),
  p('distributor.view_assigned', 'Distributors', 'View', 'View assigned distributors', 'See distributors in assigned territories / regions.'),
  p('distributor.view_all', 'Distributors', 'View', 'View all distributors', 'See every distributor account.'),
  p('distributor.manage', 'Distributors', 'Manage', 'Manage distributor status', 'Put accounts on hold, block or reactivate.'),

  // Catalog
  p('catalog.view', 'Product catalog', 'View', 'View catalog', 'Browse products, prices and availability.'),

  // Sales orders
  p('order.view_own', 'Sales orders', 'View', 'View own orders', 'See requests and orders of the user’s distributor account.'),
  p('order.view_assigned', 'Sales orders', 'View', 'View assigned orders', 'See requests in assigned territories / regions.'),
  p('order.view_all', 'Sales orders', 'View', 'View all orders', 'See every request and order.'),
  p('order.create', 'Sales orders', 'Create', 'Create order request', 'Build carts, save drafts and submit requests.'),
  p('order.create_on_behalf', 'Sales orders', 'Create', 'Create on behalf of distributor', 'Choose any distributor in scope when creating a request.'),
  p('order.cancel', 'Sales orders', 'Edit', 'Cancel / revise request', 'Cancel or revise requests the user can create.'),
  p('order.comment', 'Sales orders', 'Edit', 'Comment on requests', 'Add comments to request activity.'),
  p('order.approval_monitor', 'Sales orders', 'View', 'Monitor approvals', 'Open the approval workbench to monitor requests in approval.'),
  p('order.approve', 'Sales orders', 'Approve', 'Approve order request', 'Approve at the user’s approval level (territory / region / final).'),
  p('order.reject', 'Sales orders', 'Reject', 'Reject order request', 'Reject a request at the user’s level.'),
  p('order.return_to_requester', 'Sales orders', 'Return', 'Request changes', 'Return a request to the requester for changes.'),
  p('order.return_to_previous_approver', 'Sales orders', 'Return', 'Return to previous approver', 'Send a request back to an earlier approval level.'),

  // Finance
  p('invoice.view', 'Finance', 'View', 'View proforma invoices', 'See proforma invoices in scope.'),
  p('invoice.issue', 'Finance', 'Create', 'Issue proforma invoice', 'Issue proforma invoices for approved requests.'),
  p('payment.view', 'Finance', 'View', 'View payments', 'See payments and receipts in scope.'),
  p('payment.upload_receipt', 'Finance', 'Create', 'Upload payment receipt', 'Upload proof of payment against a proforma.'),
  p('payment.verify', 'Finance', 'Approve', 'Verify payment', 'Verify or reject uploaded receipts.'),

  // Fulfilment
  p('shipment.view', 'Fulfilment', 'View', 'View shipments', 'Track shipments in scope.'),
  p('shipment.update', 'Fulfilment', 'Edit', 'Update shipments', 'Advance shipment status and confirm collection.'),
  p('collection.view', 'Fulfilment', 'View', 'View collection readiness', 'Open the collection readiness board.'),
  p('document.view', 'Fulfilment', 'View', 'View documents', 'See documents in scope.'),
  p('document.upload', 'Fulfilment', 'Create', 'Upload documents', 'Upload registration and shipping documents.'),

  // Communication
  p('email.view', 'Communication', 'View', 'View conversations', 'Read email conversations in scope.'),
  p('email.send', 'Communication', 'Create', 'Compose & reply', 'Compose, reply and link conversations (simulated).'),
  p('followup.manage', 'Communication', 'Manage', 'Manage follow-ups', 'Schedule and complete follow-ups.'),

  // Administration
  p('user.view', 'Administration', 'View', 'View users', 'See users, their roles and assignments.', true),
  p('user.manage', 'Administration', 'Manage', 'Manage users', 'Add, edit, activate/deactivate users and assign roles.', true),
  p('role.view', 'Administration', 'View', 'View roles & matrix', 'See roles and the authorization matrix.', true),
  p('role.manage', 'Administration', 'Manage', 'Manage roles', 'Create, rename and delete roles.', true),
  p('permission.manage', 'Administration', 'Manage', 'Manage permissions', 'Grant or revoke permissions on roles.', true),
  p('territory.view', 'Administration', 'View', 'View territories', 'See territories, regions and brand visibility.'),
  p('territory.manage', 'Administration', 'Manage', 'Manage territories', 'Change territory managers and brand visibility.'),
  p('workflow.view', 'Administration', 'View', 'View workflow rules', 'See approval bands, onboarding stages and policies.'),
  p('workflow.manage', 'Administration', 'Manage', 'Manage workflow rules', 'Change approval bands, onboarding stages and policies.'),
  p('integration.view', 'Administration', 'View', 'View integration monitor', 'See simulated ERP integration status.'),
  p('integration.retry', 'Administration', 'Edit', 'Retry integration records', 'Retry failed synchronisation (simulated).'),
  p('audit.view', 'Administration', 'View', 'View audit trail', 'See the consolidated audit trail.'),
]

export const PERMISSION_IDS = new Set(PERMISSIONS.map((x) => x.id))
export const permissionById = (id: string) => PERMISSIONS.find((x) => x.id === id)
export const CRITICAL_PERMISSIONS = PERMISSIONS.filter((x) => x.critical).map((x) => x.id)
