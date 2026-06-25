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
  isArray: () => false,
}

/**
 * Flatten a potentially nested object to a flat key:value map.
 * Used to normalise deeply-nested XML structures into tabular rows.
 * E.g. { client: { name: 'Ivan', phone: '79001234567' } }
 *   → { 'client.name': 'Ivan', 'client.phone': '79001234567' }
 */
function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj == null) return out

  if (typeof obj !== 'object') {
    out[prefix] = String(obj)
    return out
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, nextKey, out)
    } else if (Array.isArray(value)) {
      // Arrays: take the first element for header discovery, index later
      if (value.length > 0 && typeof value[0] === 'object') {
        flatten(value[0], nextKey, out)
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
 * Auto-detect the repeating element in parsed XML.
 * Looks for the first array value in the top-level object.
 */
function findRepeatingPath(parsed: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) return key
    if (value && typeof value === 'object') {
      // One level deeper
      for (const [k2, v2] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(v2)) return `${key}.${k2}`
      }
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

/**
 * Parse & analyse an XML file. Reads the full file — suitable for XML up to ~50MB.
 * For truly large XML (100MB+) a SAX-style streaming parser (expat-xml) would be needed,
 * but CRM export files are typically <20MB.
 */
export async function analyseXml(filePath: string): Promise<XmlAnalysis> {
  const content = fs.readFileSync(filePath, 'utf-8')

  const parser = new XMLParser(XML_PARSER_OPTIONS)
  const parsed = parser.parse(content) as Record<string, unknown>

  const repeatingPath = findRepeatingPath(parsed)
  if (!repeatingPath) {
    // Single-record or non-tabular XML — wrap root in array
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

  const sample = rowArray.slice(0, 50).map(r => flatten(r))
  const headers = sample.length > 0
    ? [...new Set(sample.flatMap(r => Object.keys(r)))]
    : []

  return {
    headers,
    sample,
    total_rows: rowArray.length,
    encoding: 'UTF-8',
  }
}

/**
 * Stream XML rows one by one.
 * Parses entire file then yields — acceptable for files the XMLParser can handle.
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
    const row = flatten(rawRow)
    try {
      await onRow(row, processed)
      processed++
    } catch {
      failed++
    }
  }

  return { processed, failed }
}
