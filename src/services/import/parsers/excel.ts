import fs from 'fs'
import * as XLSX from 'xlsx'
import { assertReadable } from '../fileStore'

export interface ExcelAnalysis {
  headers: string[]
  sample: Record<string, string>[]
  total_rows: number
  sheets: string[]
  encoding: 'UTF-8'
}

/**
 * Analyse an Excel file (xlsx/xls).
 * For files <20MB, reads fully (XLSX.readFile).
 * For larger files, uses streaming sheet reader to avoid OOM.
 */
export async function analyseExcel(
  filePath: string,
  sheetName?: string
): Promise<ExcelAnalysis> {
  assertReadable(filePath)
  const stat = fs.statSync(filePath)
  const useSparse = stat.size > 20 * 1024 * 1024  // 20MB threshold

  const workbook = useSparse
    ? XLSX.readFile(filePath, { type: 'file', cellDates: true, sheetRows: 0 })
    : XLSX.readFile(filePath, { type: 'file', cellDates: true })

  const sheets = workbook.SheetNames

  const targetSheet = sheetName && sheets.includes(sheetName)
    ? sheetName
    : sheets[0]

  if (useSparse) {
    // Re-read only the target sheet to limit memory
    const wb2 = XLSX.readFile(filePath, {
      type: 'file',
      cellDates: true,
      sheets: targetSheet,
    })
    return extractSheetData(wb2, targetSheet, sheets)
  }

  return extractSheetData(workbook, targetSheet, sheets)
}

function extractSheetData(
  workbook: XLSX.WorkBook,
  sheetName: string,
  allSheets: string[]
): ExcelAnalysis {
  const ws = workbook.Sheets[sheetName]
  if (!ws) {
    return { headers: [], sample: [], total_rows: 0, sheets: allSheets, encoding: 'UTF-8' }
  }

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  const total_rows = Math.max(0, range.e.r)  // exclude header row

  // sheet_to_json gives us [{header: value}] — limit to first 50 for preview
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: false,          // coerce all values to strings
    defval: '',          // empty cells become ''
    blankrows: false,
  })

  const sample = rows.slice(0, 50).map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')]))
  )

  const headers = sample.length > 0 ? Object.keys(sample[0]) : []

  return { headers, sample, total_rows, sheets: allSheets, encoding: 'UTF-8' }
}

/**
 * Stream an Excel sheet row by row with a callback.
 * Uses sheet_to_json to keep the whole row set out of the hot path.
 * For truly huge Excel files, use the streaming XLSX.stream API instead.
 */
export async function streamExcel(
  filePath: string,
  sheetName: string,
  onRow: (row: Record<string, string>, index: number) => Promise<void>,
  signal?: AbortSignal
): Promise<{ processed: number; failed: number }> {
  assertReadable(filePath)
  const workbook = XLSX.readFile(filePath, {
    type: 'file',
    cellDates: true,
    sheets: sheetName,
  })

  const resolvedSheet = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0]
  const ws = resolvedSheet ? workbook.Sheets[resolvedSheet] : undefined
  if (!ws) return { processed: 0, failed: 0 }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: false,
    defval: '',
    blankrows: false,
  })

  let processed = 0
  let failed = 0

  for (const rawRow of rows) {
    if (signal?.aborted) break

    const row = Object.fromEntries(
      Object.entries(rawRow).map(([k, v]) => [k, String(v ?? '')])
    )

    try {
      await onRow(row, processed)
      processed++
    } catch {
      failed++
    }
  }

  return { processed, failed }
}
