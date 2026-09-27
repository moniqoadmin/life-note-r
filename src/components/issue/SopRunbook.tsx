import { useState } from 'react'
import { DUMMY_SOP, type SopStep } from '../../lib/sop'

const utcTime = () => new Date().toISOString().slice(11, 16) + ' UTC'

const STATE_LABEL: Record<SopStep['state'], string> = {
  VERIFIED: 'Verified',
  IN_PROGRESS: 'In Progress',
  PENDING: 'Pending',
}

interface AuditEntry {
  at: string
  text: string
}

const SEED_AUDIT: AuditEntry[] = [
  { at: '14:22 UTC', text: 'Step 1 verified by test@yopmail.com' },
  { at: '14:26 UTC', text: 'Step 2 verified by automated pipeline #4418' },
  { at: '14:31 UTC', text: 'Step 3 verified — Vault key rotated to v3' },
  { at: '14:33 UTC', text: 'Step 4 started' },
]

/** Marks step `i` verified and promotes the next pending step to in-progress. */
function completeStep(steps: SopStep[], i: number, meta: string): SopStep[] {
  return steps.map((s, j) => {
    if (j === i) return { ...s, state: 'VERIFIED', meta }
    if (j === i + 1 && s.state === 'PENDING') return { ...s, state: 'IN_PROGRESS' }
    return s
  })
}

export function SopRunbook({ userEmail }: { userEmail: string }) {
  const [steps, setSteps] = useState(DUMMY_SOP.steps)
  const [tab, setTab] = useState<'manual' | 'audit'>('manual')
  const [audit, setAudit] = useState(SEED_AUDIT)
  const [running, setRunning] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const done = steps.filter((s) => s.state === 'VERIFIED').length
  const total = steps.length
  const pct = Math.round((done / total) * 100)
  const activeIdx = steps.findIndex((s) => s.state === 'IN_PROGRESS')

  function log(text: string) {
    setAudit((a) => [...a, { at: utcTime(), text }])
  }

  function verify(i: number, by = userEmail) {
    const next = steps[i + 1]
    setSteps((s) => completeStep(s, i, `Completed by ${by} at ${utcTime()}`))
    log(`Step ${i + 1} verified by ${by}`)
    if (next?.state === 'PENDING') log(`Step ${i + 2} started`)
  }

  // Simulated execution: no command is actually run while this is dummy data.
  function execute(i: number) {
    setRunning(steps[i]!.id)
    log(`Step ${i + 1} executed: ${steps[i]!.command}`)
    setTimeout(() => {
      setRunning(null)
      verify(i)
    }, 1200)
  }

  function signOff(i: number) {
    const text = notes.trim()
    if (!text) return
    verify(i)
    log(`Sign-off notes: ${text}`)
    setNotes('')
  }

  function reset() {
    setSteps(DUMMY_SOP.steps)
    setAudit(SEED_AUDIT)
    setNotes('')
    setRunning(null)
  }

  return (
    <div className="sop card">
      <div className="sop-head">
        <span className="sop-code">
          📘 {DUMMY_SOP.code}: {DUMMY_SOP.title}
        </span>
        <span className={`sop-active${done === total ? ' complete' : ''}`}>
          ● {done === total ? 'Runbook Complete' : 'Active Runbook'} · {done} of {total} Steps Complete ({pct}%)
        </span>
        <p className="muted sop-summary">{DUMMY_SOP.summary}</p>
        <div className="sop-tabs">
          <button type="button" className={tab === 'manual' ? 'on' : ''} onClick={() => setTab('manual')}>
            ☑ Manual
          </button>
          <button type="button" className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>
            ⧉ Audit Trail
          </button>
          <button type="button" className="ghost-icon" title="Reset runbook (demo)" onClick={reset}>
            ↺
          </button>
        </div>
      </div>

      <div className="progress sop-progress">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sop-progress-meta muted small">
        <span>{done} completed</span>
        <span>{activeIdx >= 0 ? `Step ${activeIdx + 1} active in current rollout` : 'All steps verified'}</span>
        <span>{total - done} remaining</span>
      </div>

      {tab === 'audit' ? (
        <ol className="sop-audit">
          {audit.map((e, i) => (
            <li key={i}>
              <span className="sop-audit-at">{e.at}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="sop-steps">
          {steps.map((s, i) => {
            const isRunning = running === s.id
            return (
              <li key={s.id} className={`sop-step sop-${s.state.toLowerCase()}`}>
                <span className="sop-marker">
                  {s.state === 'VERIFIED' ? (
                    '✓'
                  ) : s.state === 'IN_PROGRESS' && !s.signOffPlaceholder ? (
                    <input
                      type="checkbox"
                      aria-label={`Mark step ${i + 1} verified`}
                      disabled={isRunning}
                      onChange={() => verify(i)}
                    />
                  ) : s.state === 'PENDING' ? (
                    '🔒'
                  ) : (
                    '✎'
                  )}
                </span>
                <div className="sop-step-body">
                  <div className="sop-step-head">
                    <span className="sop-step-title">
                      {i + 1}. {s.title}
                      {s.state === 'IN_PROGRESS' && <span className="sop-live" />}
                    </span>
                    <span className="sop-state">
                      {s.state === 'PENDING' ? `Pending Step ${i}` : STATE_LABEL[s.state]}
                    </span>
                  </div>
                  {s.meta && <p className="sop-meta muted">{s.meta}</p>}
                  {s.description && s.state !== 'VERIFIED' && <p className="sop-desc">{s.description}</p>}
                  {s.command && (
                    <div className="sop-cmd">
                      <code>{s.command}</code>
                      {s.state === 'VERIFIED' && s.result && <span className="sop-result">✓ {s.result}</span>}
                      {s.state === 'IN_PROGRESS' && (
                        <button type="button" className="primary-btn sm" disabled={isRunning} onClick={() => execute(i)}>
                          {isRunning ? 'Running…' : '▶ Execute Step'}
                        </button>
                      )}
                    </div>
                  )}
                  {s.signOffPlaceholder && s.state !== 'VERIFIED' && (
                    <div className="sop-signoff">
                      <input
                        className="inline-input"
                        value={notes}
                        disabled={s.state === 'PENDING'}
                        maxLength={1000}
                        onChange={(e) => setNotes(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && signOff(i)}
                        placeholder={s.signOffPlaceholder}
                      />
                      {s.state === 'IN_PROGRESS' && (
                        <button type="button" className="primary-btn sm" disabled={!notes.trim()} onClick={() => signOff(i)}>
                          Sign off
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
