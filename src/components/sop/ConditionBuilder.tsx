import { useState } from 'react'
import type { Condition, Operator } from '../../api/sops'
import { useSopMeta } from '../../hooks/useSops'
import {
  OPERATOR_LABEL,
  buildFieldPath,
  fromGroup,
  parseFieldPath,
  parseValue,
  toGroup,
  valueToText,
  type CondGroup,
  type CondNode,
} from '../../lib/sopConditions'

interface StepOption {
  key: string
  title: string
}

/**
 * Visual editor for an SOP condition tree (ALL / ANY groups of `field operator value`
 * rows, nestable, negatable), with a raw JSON fallback for anything unusual.
 */
export function ConditionBuilder({
  value,
  onChange,
  steps = [],
  emptyLabel = 'Always',
}: {
  value: Condition | null
  onChange: (value: Condition | null) => void
  /** Step keys offered for steps.<key>.* and trigger.stepKey. */
  steps?: StepOption[]
  emptyLabel?: string
}) {
  const [group, setGroup] = useState<CondGroup>(() => toGroup(value))
  const [json, setJson] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)

  function update(next: CondGroup) {
    setGroup(next)
    onChange(fromGroup(next))
  }

  if (json !== null) {
    return (
      <div className="cond cond-json">
        <textarea
          className="sop-input mono"
          rows={6}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
        />
        {jsonError && <p className="error small">{jsonError}</p>}
        <div className="row-actions">
          <button
            type="button"
            className="pill-btn sm"
            onClick={() => {
              try {
                const parsed = json.trim() ? (JSON.parse(json) as Condition) : null
                setGroup(toGroup(parsed))
                onChange(parsed)
                setJson(null)
                setJsonError(null)
              } catch (e) {
                setJsonError((e as Error).message)
              }
            }}
          >
            Apply JSON
          </button>
          <button type="button" className="text-btn sm" onClick={() => setJson(null)}>
            Back to builder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cond">
      <GroupEditor group={group} onChange={update} steps={steps} depth={0} emptyLabel={emptyLabel} />
      <button
        type="button"
        className="text-btn sm cond-json-toggle"
        onClick={() => setJson(JSON.stringify(fromGroup(group), null, 2) ?? '')}
      >
        {'{ } JSON'}
      </button>
    </div>
  )
}

function GroupEditor({
  group,
  onChange,
  steps,
  depth,
  emptyLabel,
  onRemove,
}: {
  group: CondGroup
  onChange: (group: CondGroup) => void
  steps: StepOption[]
  depth: number
  emptyLabel: string
  onRemove?: () => void
}) {
  const setItem = (index: number, node: CondNode) =>
    onChange({ ...group, items: group.items.map((item, i) => (i === index ? node : item)) })
  const removeItem = (index: number) => onChange({ ...group, items: group.items.filter((_, i) => i !== index) })

  return (
    <div className={`cond-group depth-${depth}`}>
      <div className="cond-group-head">
        {group.items.length === 0 ? (
          <span className="muted small">{emptyLabel}</span>
        ) : (
          <>
            <label className="cond-negate small">
              <input type="checkbox" checked={group.negate} onChange={(e) => onChange({ ...group, negate: e.target.checked })} />
              NOT
            </label>
            {group.items.length > 1 && (
              <select
                className="sop-select sm"
                value={group.mode}
                onChange={(e) => onChange({ ...group, mode: e.target.value as 'all' | 'any' })}
              >
                <option value="all">ALL of</option>
                <option value="any">ANY of</option>
              </select>
            )}
          </>
        )}
        {onRemove && (
          <button type="button" className="row-remove visible" aria-label="Remove group" onClick={onRemove}>
            ×
          </button>
        )}
      </div>
      {group.items.map((item, i) =>
        item.kind === 'group' ? (
          <GroupEditor
            key={i}
            group={item}
            onChange={(g) => setItem(i, g)}
            steps={steps}
            depth={depth + 1}
            emptyLabel="Empty group"
            onRemove={() => removeItem(i)}
          />
        ) : (
          <LeafEditor key={i} leaf={item} onChange={(l) => setItem(i, l)} onRemove={() => removeItem(i)} steps={steps} />
        ),
      )}
      <div className="row-actions">
        <button
          type="button"
          className="text-btn sm"
          onClick={() =>
            onChange({ ...group, items: [...group.items, { kind: 'leaf', field: 'issue.status', operator: 'EQUALS', value: 'TODO' }] })
          }
        >
          + Condition
        </button>
        {depth < 2 && (
          <button
            type="button"
            className="text-btn sm"
            onClick={() => onChange({ ...group, items: [...group.items, { kind: 'group', mode: 'any', negate: false, items: [] }] })}
          >
            + Group
          </button>
        )}
      </div>
    </div>
  )
}

function LeafEditor({
  leaf,
  onChange,
  onRemove,
  steps,
}: {
  leaf: CondNode & { kind: 'leaf' }
  onChange: (leaf: CondNode & { kind: 'leaf' }) => void
  onRemove: () => void
  steps: StepOption[]
}) {
  const { data: meta } = useSopMeta()
  const { template, key } = parseFieldPath(leaf.field)
  const fieldDef = meta?.fields.find((f) => f.path === template)
  const opDef = meta?.operators.find((o) => o.operator === leaf.operator)
  const [text, setText] = useState(valueToText(leaf.value))

  const setValueText = (raw: string) => {
    setText(raw)
    onChange({ ...leaf, value: parseValue(raw, leaf.operator, fieldDef?.kind) })
  }
  const needsKey = template.includes('<key>')
  const isStepField = template.startsWith('steps.<key>.')
  const stepValued = fieldDef?.kind === 'step'

  return (
    <div className="cond-leaf">
      <select
        className="sop-select sm"
        value={template}
        onChange={(e) => {
          const next = meta?.fields.find((f) => f.path === e.target.value)
          const nextKey = e.target.value.startsWith('steps.') ? key || steps[0]?.key || 'step' : key
          const value = next?.values?.[0] ?? ''
          setText(valueToText(value))
          onChange({ kind: 'leaf', field: buildFieldPath(e.target.value, nextKey), operator: 'EQUALS', value })
        }}
      >
        {!fieldDef && <option value={template}>{leaf.field}</option>}
        {meta?.fields.map((f) => (
          <option key={f.path} value={f.path}>
            {f.label}
          </option>
        ))}
      </select>
      {needsKey &&
        (isStepField ? (
          <select
            className="sop-select sm"
            value={key}
            onChange={(e) => onChange({ ...leaf, field: buildFieldPath(template, e.target.value) })}
          >
            {!steps.some((s) => s.key === key) && <option value={key}>{key}</option>}
            {steps.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="sop-input sm key-input"
            value={key}
            placeholder="fieldName"
            onChange={(e) => onChange({ ...leaf, field: buildFieldPath(template, e.target.value.replace(/[^A-Za-z0-9_]/g, '')) })}
          />
        ))}
      <select
        className="sop-select sm"
        value={leaf.operator}
        onChange={(e) => {
          const operator = e.target.value as Operator
          const unary = meta?.operators.find((o) => o.operator === operator)?.unary
          onChange({ ...leaf, operator, value: unary ? undefined : parseValue(text, operator, fieldDef?.kind) })
        }}
      >
        {(meta?.operators ?? []).map((o) => (
          <option key={o.operator} value={o.operator}>
            {OPERATOR_LABEL[o.operator]}
          </option>
        ))}
      </select>
      {!opDef?.unary &&
        (stepValued && !opDef?.arrayValue ? (
          <select className="sop-select sm" value={text} onChange={(e) => setValueText(e.target.value)}>
            <option value="">—</option>
            {steps.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
        ) : fieldDef?.values && !opDef?.arrayValue ? (
          <select className="sop-select sm" value={text} onChange={(e) => setValueText(e.target.value)}>
            {!fieldDef.values.includes(text) && <option value={text}>{text || '—'}</option>}
            {fieldDef.values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="sop-input sm"
            value={text}
            type={fieldDef?.kind === 'number' && !opDef?.arrayValue ? 'number' : 'text'}
            placeholder={opDef?.arrayValue ? 'a, b, c' : 'value'}
            onChange={(e) => setValueText(e.target.value)}
          />
        ))}
      <button type="button" className="row-remove visible" aria-label="Remove condition" onClick={onRemove}>
        ×
      </button>
    </div>
  )
}
