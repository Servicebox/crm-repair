import Fuse from 'fuse.js'
import { TARGET_FIELDS, getFieldsForEntity, type TargetField } from './fieldDefinitions'

interface FuzzyEntry {
  path: string
  label: string
  entity: string
  searchText: string
}

function buildIndex(fields: TargetField[]): Fuse<FuzzyEntry> {
  const entries: FuzzyEntry[] = fields.flatMap(f => [
    // Main entry: path + label
    { path: f.path, label: f.label, entity: f.entity, searchText: f.label.toLowerCase() },
    // One entry per synonym for scoring
    ...f.synonyms.map(s => ({
      path: f.path,
      label: f.label,
      entity: f.entity,
      searchText: s.toLowerCase(),
    })),
  ])

  return new Fuse(entries, {
    keys: ['searchText'],
    threshold: 0.45,    // 0 = exact, 1 = anything; 0.45 catches abbreviations well
    includeScore: true,
    shouldSort: true,
    minMatchCharLength: 2,
  })
}

let fuseAll: Fuse<FuzzyEntry> | null = null
const fuseByEntity: Map<string, Fuse<FuzzyEntry>> = new Map()

function getFuse(entity?: string): Fuse<FuzzyEntry> {
  if (entity) {
    if (!fuseByEntity.has(entity)) {
      fuseByEntity.set(entity, buildIndex(getFieldsForEntity(entity)))
    }
    return fuseByEntity.get(entity)!
  }
  if (!fuseAll) fuseAll = buildIndex(TARGET_FIELDS)
  return fuseAll
}

export interface FieldSuggestion {
  path: string
  label: string
  confidence: number
}

/**
 * Suggest target field for a source column name.
 * @param columnName  Raw column name from CSV/Excel header
 * @param entity      Target entity ('clients' | 'orders' | 'products'), optional
 */
export function suggestField(columnName: string, entity?: string): FieldSuggestion | null {
  if (!columnName?.trim()) return null

  const fuse = getFuse(entity)
  const normalised = columnName.toLowerCase().trim()

  const results = fuse.search(normalised)
  if (!results.length) return null

  const best = results[0]
  // Fuse score: 0 = perfect match, 1 = no match. Invert to get confidence.
  const confidence = 1 - (best.score ?? 1)

  if (confidence < 0.4) return null

  // Deduplicate: take the first result for this path (synonyms generate duplicates)
  return {
    path: best.item.path,
    label: best.item.label,
    confidence: Math.round(confidence * 100) / 100,
  }
}

/**
 * Auto-map all columns in one pass.
 */
export function autoMapColumns(
  columnNames: string[],
  entity?: string
): Array<{ source: string; suggestion: FieldSuggestion | null }> {
  return columnNames.map(name => ({
    source: name,
    suggestion: suggestField(name, entity),
  }))
}
