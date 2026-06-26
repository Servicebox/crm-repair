import fs from 'fs'
import { XMLParser } from 'fast-xml-parser'

export interface XmlAnalysis {
  headers: string[]
  sample: Record<string, string>[]
  total_rows: number
  encoding: string
}

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
  processEntities: true,   // Bug #2: decode &#xNNN; numeric character references
  htmlEntities: true,      // also decode HTML-style named entities
  isArray: () => false,
}

/**
 * Flatten a potentially nested object to a flat key:value map.
 *
 * Handles the fast-xml-parser mixed-content model:
 *   <name attr="ФИО">Борисова</name>  →  { '#text': 'Борисова', '@_attr': 'ФИО' }
 *
 * For mixed-content nodes we use the text value for the parent key and
 * silently discard the attribute siblings (they are XML metadata, not
 * tabular data).  Pure attribute keys (no text sibling) are also skipped
 * because they don't map to importable data columns.
 */
function flatten(
  obj: unknown,
  prefix = '',
  out: Record<string, string> = {}
): Record<string, string> {
  if (obj == null) return out

  if (typeof obj !== 'object') {
    if (prefix) out[prefix] = String(obj)
    return out
  }

  const record = obj as Record<string, unknown>
  const keys = Object.keys(record)

  // Mixed-content node: has '#text' key → use text as value for this path
  if (keys.includes('#text')) {
    const text = record['#text']
    if (prefix) out[prefix] = text == null ? '' : String(text)
    return out
  }

  for (const [key, value] of Object.entries(record)) {
    // Skip attribute keys — they are XML metadata, not importable columns
    if (key.startsWith('@_')) continue

    const nextKey = prefix ? `${prefix}.${key}` : key

    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, nextKey, out)
    } else if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object') {
        flatten(value[0] as Record<string, unknown>, nextKey, out)
      } else {
        out[nextKey] = value.join(', ')
      }
    } else {
      out[nextKey] = value == null ? '' : String(value)
    }
  }
  return out
}

/**
 * Auto-detect the repeating element path in parsed XML.
 * Recursively walks the object looking for the first array value,
 * skipping attribute keys (@_*) which are never arrays of rows.
 * Bounded to 5 levels deep to avoid runaway traversal.
 */
function findRepeatingPath(
  obj: Record<string, unknown>,
  prefix = '',
  depth = 0
): string | null {
  if (depth >= 5) return null
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_')) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) return path
    if (value && typeof value === 'object') {
      const found = findRepeatingPath(value as Record<string, unknown>, path, depth + 1)
      if (found) return found
    }
  }
  return null
}

function getAtPath(obj: unknown, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

export async function analyseXml(filePath: string): Promise<XmlAnalysis> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(content) as Record<string, unknown>

  const repeatingPath = findRepeatingPath(parsed)
  if (!repeatingPath) {
    const flattened = flatten(parsed)
    return {
      headers: Object.keys(flattened),
      sample: [flattened],
      total_rows: 1,
      encoding: 'UTF-8',
    }
  }

  const rows = getAtPath(parsed, repeatingPath)
  const rowArray = Array.isArray(rows) ? rows : [rows]

  const sample = rowArray.slice(0, 50).map(r => flatten(r as Record<string, unknown>))
  const headers = sample.length > 0
    ? [...new Set(sample.flatMap(r => Object.keys(r)))]
    : []

  return { headers, sample, total_rows: rowArray.length, encoding: 'UTF-8' }
}

/**
 * Stream XML rows one by one.
 * Parses entire file then yields — acceptable for XML up to ~50MB.
 */
export async function streamXml(
  filePath: string,
  onRow: (row: Record<string, string>, index: number) => Promise<void>,
  signal?: AbortSignal
): Promise<{ processed: number; failed: number }> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(content) as Record<string, unknown>

  const repeatingPath = findRepeatingPath(parsed)
  const root = repeatingPath ? getAtPath(parsed, repeatingPath) : parsed
  const rows = Array.isArray(root) ? root : [root]

  let processed = 0
  let failed = 0

  for (const rawRow of rows) {
    if (signal?.aborted) break
    const row = flatten(rawRow as Record<string, unknown>)
    try {
      await onRow(row, processed)
      processed++
    } catch {
      failed++
    }
  }

  return { processed, failed }
}
