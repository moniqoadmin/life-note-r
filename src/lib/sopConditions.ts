import type { Condition, ConditionLeaf, Operator, SopMeta } from '../api/sops'

// Editable form of a condition tree: every level is a group (ALL / ANY, optionally
// negated) of leaves and sub-groups. Converted to/from the backend's JSON shape.
export interface CondGroup {
  kind: 'group'
  mode: 'all' | 'any'
  negate: boolean
  items: CondNode[]
}
export type CondNode = CondGroup | (ConditionLeaf & { kind: 'leaf' })

export const emptyGroup = (): CondGroup => ({ kind: 'group', mode: 'all', negate: false, items: [] })

export function toGroup(condition: Condition | null | undefined): CondGroup {
  if (!condition) return emptyGroup()
  if ('not' in condition) {
    const inner = toGroup(condition.not)
    return { ...inner, negate: !inner.negate }
  }
  if ('all' in condition) return { kind: 'group', mode: 'all', negate: false, items: condition.all.map(toNode) }
  if ('any' in condition) return { kind: 'group', mode: 'any', negate: false, items: condition.any.map(toNode) }
  return { kind: 'group', mode: 'all', negate: false, items: [{ kind: 'leaf', ...condition }] }
}

function toNode(condition: Condition): CondNode {
  if ('field' in condition) return { kind: 'leaf', ...condition }
  return toGroup(condition)
}

/** Back to JSON; an empty group means "no condition" (null). */
export function fromGroup(group: CondGroup): Condition | null {
  const items = group.items.map(fromNode).filter((c): c is Condition => c !== null)
  if (items.length === 0) return null
  const body: Condition = items.length === 1 && !group.negate && group.mode === 'all' ? items[0]! : { [group.mode]: items } as Condition
  return group.negate ? { not: body } : body
}

function fromNode(node: CondNode): Condition | null {
  if (node.kind === 'group') return fromGroup(node)
  const { kind: _kind, ...leaf } = node
  return leaf
}

export const OPERATOR_LABEL: Record<Operator, string> = {
  EQUALS: 'is',
  NOT_EQUALS: 'is not',
  CONTAINS: 'contains',
  NOT_CONTAINS: "doesn't contain",
  IN: 'is one of',
  NOT_IN: 'is none of',
  GREATER_THAN: '>',
  GREATER_THAN_OR_EQUAL: '≥',
  LESS_THAN: '<',
  LESS_THAN_OR_EQUAL: '≤',
  EXISTS: 'is set',
  NOT_EXISTS: 'is empty',
}

/** Splits "fields.riskLevel" → template "fields.<key>", key "riskLevel" (same for steps.<key>.x). */
export function parseFieldPath(path: string): { template: string; key: string } {
  if (path.startsWith('fields.')) return { template: 'fields.<key>', key: path.slice('fields.'.length) }
  const step = /^steps\.([^.]+)\.(\w+)$/.exec(path)
  if (step) return { template: `steps.<key>.${step[2]}`, key: step[1]! }
  return { template: path, key: '' }
}

export const buildFieldPath = (template: string, key: string) => template.replace('<key>', key || 'key')

export function fieldLabel(path: string, meta?: SopMeta) {
  const { template, key } = parseFieldPath(path)
  const known = meta?.fields.find((f) => f.path === template)
  if (template === 'fields.<key>') return key
  if (template.startsWith('steps.<key>.')) return `step "${key}" ${template.split('.').at(-1)}`
  return known?.label.toLowerCase() ?? path
}

const show = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : JSON.stringify(value)

/** Human-readable summary, e.g. "type is BUG and risk level is HIGH". */
export function describeCondition(condition: Condition | null | undefined, meta?: SopMeta): string {
  if (!condition) return 'always'
  if ('not' in condition) return `not (${describeCondition(condition.not, meta)})`
  if ('all' in condition) return condition.all.map((c) => describeCondition(c, meta)).join(' and ')
  if ('any' in condition) return condition.any.map((c) => describeCondition(c, meta)).join(' or ')
  const op = OPERATOR_LABEL[condition.operator] ?? condition.operator
  return condition.operator === 'EXISTS' || condition.operator === 'NOT_EXISTS'
    ? `${fieldLabel(condition.field, meta)} ${op}`
    : `${fieldLabel(condition.field, meta)} ${op} ${show(condition.value)}`
}

/** Parses a typed-in value: lists for IN/NOT_IN, numbers for number fields, else text. */
export function parseValue(raw: string, operator: Operator, kind?: string): unknown {
  if (operator === 'IN' || operator === 'NOT_IN') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (kind === 'number' && !Number.isNaN(Number(s)) ? Number(s) : s))
  }
  if (kind === 'number' && raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw)
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
}

export const valueToText = (value: unknown) =>
  value === undefined || value === null ? '' : Array.isArray(value) ? value.join(', ') : String(value)

/** lower_snake key from a label, unique among `taken`. */
export function slugKey(label: string, taken: string[]) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'item'
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}_${n}`)) n++
  return `${base}_${n}`
}
