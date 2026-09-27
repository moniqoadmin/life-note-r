// Dummy SOP runbook data. Replace with an API call once the backend exposes runbooks.

export type SopStepState = 'VERIFIED' | 'IN_PROGRESS' | 'PENDING'

export interface SopStep {
  id: string
  title: string
  state: SopStepState
  /** "Completed by …" line for verified steps, or a hint for the active/pending step. */
  meta?: string
  description?: string
  command?: string
  /** Short result shown next to the command once the step is verified. */
  result?: string
  /** Manual steps take free-text sign-off notes instead of a command. */
  signOffPlaceholder?: string
}

export interface Sop {
  code: string
  title: string
  summary: string
  steps: SopStep[]
}

export const DUMMY_SOP: Sop = {
  code: 'SOP-042',
  title: 'OAuth2 Token Leak Revocation & Service Recovery',
  summary: 'Standard incident response procedures mapped directly to this security mitigation ticket.',
  steps: [
    {
      id: 's1',
      title: 'Identify & Revoke Affected Refresh Tokens',
      state: 'VERIFIED',
      meta: 'Completed by test@yopmail.com at 14:22 UTC',
      command: 'pnpm run auth:revoke --token-id=all-compromised',
      result: '3,412 tokens purged',
    },
    {
      id: 's2',
      title: 'Invalidate Active User Sessions via Redis Cluster',
      state: 'VERIFIED',
      meta: 'Completed by automated pipeline #4418 at 14:26 UTC',
      command: `REDIS-CLI: CLUSTER EVAL "return redis.call('DEL', unpack(redis.call('KEYS', 'sess:auth:*')))" 0`,
      result: 'Cluster synced',
    },
    {
      id: 's3',
      title: 'Rotate Auth Signing Keys & Secrets in Vault',
      state: 'VERIFIED',
      meta: 'Vault Fingerprint: sha256:d8c47f9e8a10bc9381 · Key Version: v3',
    },
    {
      id: 's4',
      title: 'Deploy Hotfix Patch & Re-verify Handshake',
      state: 'IN_PROGRESS',
      description: 'Re-roll pods running the auth-gateway ingress container with zero-downtime rolling update.',
      command: 'kubectl rollout restart deployment/auth-gateway -n prod',
      result: 'Rollout complete',
    },
    {
      id: 's5',
      title: 'Notify Security Incident Channel & Customer Support',
      state: 'PENDING',
      meta: 'Requires post-restart verification telemetry confirmation & Lead Sign-off',
      signOffPlaceholder: 'Mandatory sign-off notes & incident Slack permalink…',
    },
  ],
}
