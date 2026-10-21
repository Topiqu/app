export interface DomainValidationRecord {
  type: string
  name: string
  value: string
  purpose?: 'hostname' | 'certificate'
  active?: boolean
}

export const readDomainValidationRecords = (value: unknown): DomainValidationRecord[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is DomainValidationRecord =>
          !!entry &&
          typeof entry === 'object' &&
          typeof entry.type === 'string' &&
          typeof entry.name === 'string' &&
          typeof entry.value === 'string',
      )
    : []

// A new CA order can replace a challenge at the same DNS name. Keep the old
// value visible as history, but never instruct customers to install it again.
export const mergeDomainValidationRecords = (previous: unknown, current: DomainValidationRecord[]) => {
  const key = (entry: DomainValidationRecord) => JSON.stringify([entry.type, entry.name, entry.value])
  const active = new Map(current.map((entry) => [key(entry), { ...entry, active: true }]))
  for (const entry of readDomainValidationRecords(previous)) {
    if (!active.has(key(entry))) active.set(key(entry), { ...entry, active: false })
  }
  return [...active.values()]
}
