/**
 * Default distributor-onboarding workflow (conceptually the `workflow_stages` table).
 * Editable at runtime in Administration › Workflow Rules › Distributor onboarding.
 */
import type { WorkflowDef } from '@/types/domain'

export const ONBOARDING_WORKFLOW_ID = 'distributor_onboarding'

export const defaultOnboardingWorkflow: WorkflowDef = {
  id: ONBOARDING_WORKFLOW_ID,
  name: 'Distributor onboarding',
  resubmitRouting: 'returning_stage',
  allowReturnToAnyPrevious: true,
  stages: [
    {
      id: 'initial_review',
      name: 'Initial review',
      publicLabel: 'Initial review',
      kind: 'review',
      roleId: 'sales_coordinator',
      assignment: 'review_region',
      slaHours: 48,
      active: true,
    },
    {
      id: 'credit_check',
      name: 'Credit & compliance check',
      publicLabel: 'Credit check',
      kind: 'approval',
      roleId: 'finance',
      assignment: 'role_queue',
      slaHours: 48,
      active: false,
    },
    {
      id: 'commercial_approval',
      name: 'Commercial approval',
      publicLabel: 'Commercial approval',
      kind: 'approval',
      roleId: 'territory_manager',
      assignment: 'territory_manager',
      slaHours: 48,
      active: true,
    },
    {
      id: 'final_approval',
      name: 'Final approval',
      publicLabel: 'Final approval',
      kind: 'approval',
      roleId: 'general_manager',
      assignment: 'role_queue',
      slaHours: 72,
      active: true,
    },
  ],
}

export const SECTION_LABELS = {
  company: 'Company details',
  contact: 'Contact & territory',
  brands: 'Requested brands',
  addresses: 'Billing & delivery addresses',
  documents: 'Supporting documents',
} as const
