import { createRule, createSop, createStep, type SopRuleInput, type SopStepInput } from '../api/sops'

/** The "Backend Production Release" example, built from the generic step types and rules. */
const BACKEND_RELEASE: { title: string; content: string; steps: SopStepInput[]; rules: SopRuleInput[] } = {
  title: 'Backend Production Release',
  content: 'From development complete to a confirmed production deployment.',
  steps: [
    { key: 'development-complete', title: 'Development Complete', type: 'USER_ACTION' },
    {
      key: 'developer-checklist',
      title: 'Developer Checklist',
      type: 'CHECKLIST',
      config: {
        items: [
          { id: 'tests', label: 'Unit tests written and passing', required: true },
          { id: 'migrations', label: 'Migrations reviewed', required: true },
          { id: 'docs', label: 'Docs / changelog updated', required: false },
        ],
      },
    },
    { key: 'pr-created', title: 'PR Created', type: 'GITHUB_ACTION', config: { event: 'PR_OPENED', allowManualCompletion: true } },
    { key: 'tech-lead-approval', title: 'Tech Lead Approval', type: 'APPROVAL', config: { requiredApprovals: 1 } },
    {
      key: 'regression-testing',
      title: 'Regression Testing',
      type: 'TESTING',
      description: 'Only for bugs.',
      condition: {
        any: [
          { field: 'issue.type', operator: 'EQUALS', value: 'BUG' },
          { field: 'note.title', operator: 'STARTS_WITH', value: 'Bug' },
        ],
      },
    },
    { key: 'qa-testing', title: 'QA Testing', type: 'TESTING' },
    { key: 'qa-approval', title: 'QA Approval', type: 'APPROVAL', config: { requiredApprovals: 1 } },
    {
      key: 'security-approval',
      title: 'Security Approval',
      type: 'APPROVAL',
      description: 'Required for anything touching payments.',
      config: { requiredApprovals: 1 },
      condition: {
        any: [
          { field: 'issue.component.name', operator: 'EQUALS', value: 'payment-service' },
          { field: 'note.path', operator: 'CONTAINS', value: 'payment-service' },
        ],
      },
    },
    { key: 'merge-to-qa', title: 'Merge to QA', type: 'GITHUB_ACTION', config: { event: 'PR_MERGED', baseBranch: 'qa', allowManualCompletion: true } },
    { key: 'release-approval', title: 'Release Approval', type: 'APPROVAL', config: { requiredApprovals: 1 } },
    {
      key: 'merge-to-production',
      title: 'Merge to Production',
      type: 'GITHUB_ACTION',
      config: { event: 'PR_MERGED', baseBranch: 'main', allowManualCompletion: true },
    },
    {
      key: 'deployment-confirmation',
      title: 'Deployment Confirmation',
      type: 'CONFIRMATION',
      requiresSignoff: true,
      config: { prompt: 'Deployment is live and health checks are green.' },
    },
  ],
  rules: [
    {
      name: 'QA failed → back to development',
      trigger: 'STEP_FAILED',
      condition: { field: 'event.step.key', operator: 'EQUALS', value: 'qa-testing' },
      actions: [{ type: 'GO_TO_STEP', stepKey: 'development-complete' }],
      enabled: true,
    },
    {
      name: 'High risk → 2 tech lead approvals',
      trigger: 'EXECUTION_STARTED',
      condition: { field: 'issue.fields.riskLevel', operator: 'EQUALS', value: 'HIGH' },
      actions: [{ type: 'REQUIRE_APPROVALS', stepKey: 'tech-lead-approval', count: 2 }],
      enabled: true,
    },
  ],
}

export async function createBackendReleaseSop() {
  const sop = await createSop({ title: BACKEND_RELEASE.title, content: BACKEND_RELEASE.content })
  for (const step of BACKEND_RELEASE.steps) await createStep(sop.id, step)
  for (const rule of BACKEND_RELEASE.rules) await createRule(sop.id, rule)
  return sop
}
