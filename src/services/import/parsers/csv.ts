import fs from 'fs'
import path from 'path'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import csvParser from 'csv-parser'

export interface ParsedRow {
  [key: string]: string
}

export interface CsvAnalysis {
  headers: string[]
  sample: ParsedRow[]
  total_rows: number
  encoding: string
}

function detectEncoding(filePath: string): string {
  // Read first 4KB for encoding detection — sufficient for chardet
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(4096)
  const bytesRead = fs.readSync(fd, buf, 0, 4096, 0)
  fs.closeSync(fd)

  const detected = chardet.detect(buf.slice(0, bytesRead))
  // Normalize common aliases
  if (!detected) return 'UTF-8'
  const upper = detected.toUpperCase()
  if (upper.includes('1251') || upper.includes('WINDOWS-1251')) return 'windows-1251'
  if (upper.includes('1252') || upper.includes('WINDOWS-1252')) return 'windows-1252'
  if (upper.includes('KOI8')) return 'koi8-r'
  return 'UTF-8'
}

function createCsvStream(filePath: string, encoding: string): NodeJS.ReadableStream {
  const raw = fs.createReadStream(filePath)
  if (encoding.toLowerCase() === 'utf-8' || encoding.toLowerCase() === 'utf8') {
    return raw
  }
  // Transcode non-UTF-8 (e.g., Windows-1251 from 1С exports) to UTF-8 on the fly
  return raw.pipe(iconv.decodeStream(encoding)).pipe(iconv.encodeStream('utf-8'))
}

/**
 * Analyse a CSV file: detect encoding, read headers, sample first 50 rows,
 * count total rows — all via streaming so large files don't OOM.
 */
export async function analyseCsv(filePath: string): Promise<CsvAnalysis> {
  const encoding = detectEncoding(filePath)
  const sample: ParsedRow[] = []
  let headers: string[] = []
  let total_rows = 0

  await new Promise<void>((resolve, reject) => {
    const stream = createCsvStream(filePath, encoding)
    const parser = csvParser({ strict: false })

    stream.pipe(parser)
      .on('headers', (h: string[]) => { headers = h })
      .on('data', (row: ParsedRow) => {
        total_rows++
        if (sample.length < 50) sample.push(row)
      })
      .on('end', resolve)
      .on('error', reject)
  })

  return { headers, sample, total_rows, encoding }
}

/**
 * Stream a CSV file, calling onRow for each record with backpressure control.
 * Designed for large files (100MB+).
 */
export async function streamCsv(
  filePath: string,
  encoding: string,
  onRow: (row: ParsedRow, index: number) => Promise<void>,
  signal?: AbortSignal
): Promise<{ processed: number; failed: number }> {
  let processed = 0
  let failed = 0

  await new Promise<void>((resolve, reject) => {
    const rawStream = createCsvStream(filePath, encoding)
    const parser = csvParser({ strict: false })

    // We need a reference to pause/resume for backpressure
    const controlled = rawStream.pipe(parser)

    controlled
      .on('data', async (row: ParsedRow) => {
        if (signal?.aborted) {
          controlled.destroy()
          resolve()
          return
        }

        // Pause → process → resume (backpressure: prevent unbounded buffer growth)
        (controlled as unknown as NodeJS.ReadableStream).pause()
        try {
          await onRow(row, processed)
          processed++
        } catch {
          failed++
        } finally {
          ;(controlled as unknown as NodeJS.ReadableStream).resume()
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  return { processed, failed }
}
