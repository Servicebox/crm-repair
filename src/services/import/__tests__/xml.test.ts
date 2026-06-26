import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { analyseXml, streamXml } from '../parsers/xml'

// Minimal XML that reproduces both bugs:
// - Elements with attributes + text content → should produce clean header, not '#text'
// - Cyrillic as numeric character references → should decode to Cyrillic string
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<document date="2026-06-26" user="&#x422;&#x430;&#x43C;&#x430;&#x440;&#x430;">
  <items>
    <item>
      <client_name name="&#x424;&#x418;&#x41E;">&#x411;&#x43E;&#x440;&#x438;&#x441;&#x43E;&#x432;&#x430; &#x422;&#x430;&#x442;&#x44C;&#x44F;&#x43D;&#x430;</client_name>
      <client_phone name="&#x422;&#x435;&#x43B;&#x435;&#x444;&#x43E;&#x43D;">+7(981)441-46-01</client_phone>
    </item>
    <item>
      <client_name name="&#x424;&#x418;&#x41E;">&#x418;&#x432;&#x430;&#x43D;&#x43E;&#x432; &#x418;&#x432;&#x430;&#x43D;</client_name>
      <client_phone name="&#x422;&#x435;&#x43B;&#x435;&#x444;&#x43E;&#x43D;">+7(999)123-45-67</client_phone>
    </item>
  </items>
</document>`

let tmpFile: string

beforeAll(() => {
  tmpFile = path.join(os.tmpdir(), `xml-test-${Date.now()}.xml`)
  fs.writeFileSync(tmpFile, SAMPLE_XML, 'utf-8')
})

afterAll(() => {
  fs.unlinkSync(tmpFile)
})

describe('analyseXml — Bug #1: clean column names', () => {
  it('should NOT expose #text pseudo-keys as column headers', async () => {
    const { headers } = await analyseXml(tmpFile)
    const hasPseudoKey = headers.some(h => h.includes('#text'))
    expect(hasPseudoKey, `Found #text in headers: ${headers}`).toBe(false)
  })

  it('should NOT expose @_attribute keys as column headers', async () => {
    const { headers } = await analyseXml(tmpFile)
    const hasAttrKey = headers.some(h => h.includes('@_'))
    expect(hasAttrKey, `Found @_ in headers: ${headers}`).toBe(false)
  })

  it('should produce human-readable column names from element tag names', async () => {
    const { headers } = await analyseXml(tmpFile)
    // We expect something like 'client_name' or 'items.item.client_name'
    expect(headers.some(h => h.includes('client_name'))).toBe(true)
    expect(headers.some(h => h.includes('client_phone'))).toBe(true)
  })
})

describe('analyseXml — Bug #2: entity decoding', () => {
  it('should decode numeric character references to Unicode strings', async () => {
    const { sample } = await analyseXml(tmpFile)
    const allValues = sample.flatMap(row => Object.values(row)).join(' ')
    // Ensure Cyrillic appears, not raw entity strings
    expect(allValues).toContain('Борисова')
    expect(allValues).not.toContain('&#x')
  })

  it('should decode Cyrillic in attribute-derived doc-level values', async () => {
    const { sample } = await analyseXml(tmpFile)
    const allValues = sample.flatMap(row => Object.values(row)).join(' ')
    expect(allValues).not.toMatch(/&#x[0-9A-Fa-f]+;/)
  })
})

describe('analyseXml — total_rows', () => {
  it('should count repeating item elements correctly', async () => {
    const { total_rows } = await analyseXml(tmpFile)
    expect(total_rows).toBe(2)
  })
})

describe('streamXml — produces clean rows', () => {
  it('should call onRow with decoded values and clean keys', async () => {
    const rows: Record<string, string>[] = []
    await streamXml(tmpFile, async row => { rows.push(row) })

    expect(rows).toHaveLength(2)
    const firstRow = rows[0]
    const keys = Object.keys(firstRow)
    expect(keys.some(k => k.includes('#text'))).toBe(false)
    expect(keys.some(k => k.includes('@_'))).toBe(false)
    // Values decoded
    expect(Object.values(firstRow).join(' ')).toContain('Борисова')
  })
})
