import { useId, useState } from 'react'
import { OPERATORS, evaluateCondition, type Condition, type ConditionLeaf, type Operator } from '../../api/sops'
import { OPERATOR_LABEL, conditionFieldSuggestions } from '../../lib/sop'

interface Row {
  field: string
  operator: Operator
  raw: string
}

const NO_VALUE: Operator[] = ['EXISTS', 'NOT_EXISTS']
const LIST_VALUE: Operator[] = ['IN', 'NOT_IN']

const isLeaf = (c: Condition): c is ConditionLeaf => 'field' in c

/** Flat AND/OR groups of simple rules fit the builder; anything nested is edited as JSON. */
function toRows(value: Condition | null): { mode: 'all' | 'any'; rows: Row[] } | null {
  const toRow = (c: Condition): Row | null =>
    isLeaf(c)
      ? { field: c.field, operator: c.operator, raw: Array.isArray(c.value) ? c.value.join(', ') : c.value === undefined ? '' : String(c.value) }
      : null
  if (!value) return { mode: 'all', rows: [] }
  if (isLeaf(value)) return { mode: 'all', rows: [toRow(value)!] }
  const group = 'all' in value ? { mode: 'all' as const, list: value.all } : 'any' in value ? { mode: 'any' as const, list: value.any } : null
  if (!group) return null
  const rows = group.list.map(toRow)
  return rows.every(Boolean) ? { mode: group.mode, rows: rows as Row[] } : null
}

const scalar = (s: string): unknown => {
  const t = s.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t)
  return t
}

function fromRows(mode: 'all' | 'any', rows: Row[]): Condition | null {
  const leaves = rows
    .filter((r) => r.field.trim())
    .map((r): ConditionLeaf => {
      if (NO_VALUE.includes(r.operator)) return { field: r.field.trim(), operator: r.operator }
      if (LIST_VALUE.includes(r.operator)) {
        return { field: r.field.trim(), operator: r.operator, value: r.raw.split(',').map(scalar).filter((v) => v !== '') }
      }
      return { field: r.field.trim(), operator: r.operator, value: scalar(r.raw) }
    })
  if (leaves.length === 0) return null
  if (leaves.length === 1) return leaves[0]!
  return mode === 'all' ? { all: leaves } : { any: leaves }
}

/**
 * Edits an SOP condition: a row per rule (field / operator / value) combined with
 * AND or OR, or raw JSON for nested trees. Optionally tests it against a sample context.
 */
export function ConditionEditor({
  value,
  onChange,
  stepKeys,
  emptyLabel = 'Always',
}: {
  value: Condition | null
  onChange: (c: Condition | null) => void
  stepKeys: string[]
  emptyLabel?: string
}) {
  const listId = useId()
  const initial = toRows(value)
  const [mode, setMode] = useState<'all' | 'any'>(initial?.mode ?? 'all')
  const [rows, setRows] = useState<Row[]>(initial?.rows ?? [])
  const [json, setJson] = useState<string | null>(initial ? null : JSON.stringify(value, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [sample, setSample] = useState('{\n  "note": { "title": "Fix bug", "path": ["payment-service"] }\n}')
  const [testResult, setTestResult] = useState<string | null>(null)

  const update = (nextMode: 'all' | 'any', next: Row[]) => {
    setMode(nextMode)
    setRows(next)
    onChange(fromRows(nextMode, next))
  }
  const setRow = (i: number, patch: Partial<Row>) => update(mode, rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  function switchToJson() {
    setJson(JSON.stringify(fromRows(mode, rows), null, 2))
    setJsonError(null)
  }
  function switchToBuilder() {
    const parsed = toRows(value)
    if (!parsed) {
      setJsonError('This condition is nested; keep editing it as JSON.')
      return
    }
    setMode(parsed.mode)
    setRows(parsed.rows)
    setJson(null)
  }
  function commitJson(text: string) {
    setJson(text)
    if (!text.trim() || text.trim() === 'null') {
      setJsonError(null)
      onChange(null)
      return
    }
    try {
      onChange(JSON.parse(text) as Condition)
      setJsonError(null)
    } catch {
      setJsonError('Not valid JSON yet')
    }
  }
  async function runTest() {
    setTestResult(null)
    try {
      const context = JSON.parse(sample) as Record<string, unknown>
      const current = json === null ? fromRows(mode, rows) : value
      if (!current) return setTestResult('No condition — always true')
      const { result } = await evaluateCondition({ condition: current, context })
      setTestResult(result ? '✓ true' : '✕ false')
    } catch (e) {
      setTestResult((e as Error).message)
    }
  }

  return (
    <div className="cond">
      {json !== null ? (
        <>
          <textarea className="sop-json" rows={6} value={json} onChange={(e) => commitJson(e.target.value)} spellCheck={false} />
          <div className="cond-bar">
            {jsonError && <span className="error small">{jsonError}</span>}
            <button type="button" className="text-btn" onClick={switchToBuilder}>
              Builder
            </button>
          </div>
        </>
      ) : (
        <>
          {rows.length === 0 && <p className="muted small">{emptyLabel}</p>}
          {rows.length > 1 && (
            <div className="cond-mode">
              Match
              <select className="sop-select sm" value={mode} onChange={(e) => update(e.target.value as 'all' | 'any', rows)}>
                <option value="all">ALL of (AND)</option>
                <option value="any">ANY of (OR)</option>
              </select>
            </div>
          )}
          {rows.map((r, i) => (
            <div key={i} className="cond-row">
              <input
                className="sop-input mono"
                list={listId}
                value={r.field}
                placeholder="note.title"
                onChange={(e) => setRow(i, { field: e.target.value })}
              />
              <select className="sop-select" value={r.operator} onChange={(e) => setRow(i, { operator: e.target.value as Operator })}>
                {OPERATORS.map((o) => (
                  <option key={o} value={o}>
                    {OPERATOR_LABEL[o]}
                  </option>
                ))}
              </select>
              {!NO_VALUE.includes(r.operator) && (
                <input
                  className="sop-input"
                  value={r.raw}
                  placeholder={LIST_VALUE.includes(r.operator) ? 'a, b, c' : 'value'}
                  onChange={(e) => setRow(i, { raw: e.target.value })}
                />
              )}
              <button type="button" className="row-remove" aria-label="Remove rule" onClick={() => update(mode, rows.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <datalist id={listId}>
            {conditionFieldSuggestions(stepKeys).map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <div className="cond-bar">
            <button type="button" className="accent-link" onClick={() => update(mode, [...rows, { field: '', operator: 'EQUALS', raw: '' }])}>
              + Add rule
            </button>
            <button type="button" className="text-btn" onClick={switchToJson}>
              JSON
            </button>
            <button type="button" className="text-btn" onClick={() => setTesting((t) => !t)}>
              Test
            </button>
          </div>
        </>
      )}
      {testing && (
        <div className="cond-test">
          <span className="muted small">Sample context</span>
          <textarea className="sop-json" rows={4} value={sample} onChange={(e) => setSample(e.target.value)} spellCheck={false} />
          <div className="cond-bar">
            <button type="button" className="pill-btn sm" onClick={runTest}>
              Evaluate
            </button>
            {testResult && <span className="small">{testResult}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
