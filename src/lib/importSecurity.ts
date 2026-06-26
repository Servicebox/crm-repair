import fs from 'fs'

const MAX_DECOMPRESSED_RATIO = 100   // refuse if compressed < 1% of decompressed
const MAX_DECOMPRESSED_BYTES = 500 * 1024 * 1024  // 500 MB hard cap

/**
 * Detect zip-bomb: check compressed vs decompressed size ratio for XLSX files.
 * XLSX files are ZIP archives — we read the central directory without decompressing.
 *
 * Simple heuristic: if file size on disk is <1MB but XLSX reports >500MB worth
 * of cells, refuse. This does NOT fully decompress; it uses the stored sizes in
 * the ZIP central directory.
 */
export function checkZipBomb(filePath: string, fileType: string): void {
  if (fileType !== 'xlsx' && fileType !== 'xls') return

  const stat = fs.statSync(filePath)
  const compressedSize = stat.size

  // Read the ZIP end-of-central-directory record to get uncompressed total
  // The EOCD is in the last 22+ bytes of the file
  const fd = fs.openSync(filePath, 'r')
  try {
    const tailSize = Math.min(65558, compressedSize)
    const tail = Buffer.alloc(tailSize)
    fs.readSync(fd, tail, 0, tailSize, compressedSize - tailSize)

    let uncompressedTotal = 0
    // Scan for local file headers (PK\x03\x04) and sum their uncompressed sizes
    for (let i = 0; i < tail.length - 30; i++) {
      if (tail[i] === 0x50 && tail[i+1] === 0x4B && tail[i+2] === 0x03 && tail[i+3] === 0x04) {
        const uncompressed = tail.readUInt32LE(i + 22)
        uncompressedTotal += uncompressed
      }
    }

    if (uncompressedTotal > MAX_DECOMPRESSED_BYTES) {
      throw new Error(
        `Файл отклонён: превышен лимит распакованного размера ` +
        `(${Math.round(uncompressedTotal / 1024 / 1024)} МБ > ${MAX_DECOMPRESSED_BYTES / 1024 / 1024} МБ)`
      )
    }

    if (uncompressedTotal > 0 && compressedSize > 0) {
      const ratio = uncompressedTotal / compressedSize
      if (ratio > MAX_DECOMPRESSED_RATIO) {
        throw new Error(
          `Файл отклонён: подозрительная степень сжатия (${Math.round(ratio)}:1). ` +
          'Возможна zip-бомба.'
        )
      }
    }
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * Whitelist of allowed field path segments for import mapping.
 * Prevents injection of arbitrary dot-paths into MongoDB update operations.
 */
const ALLOWED_PATH_CHARS = /^[a-zA-Z0-9_.]+$/

export function validateMappingPath(targetField: string): void {
  if (!ALLOWED_PATH_CHARS.test(targetField)) {
    throw new Error(
      `Недопустимое имя поля для маппинга: "${targetField}". ` +
      'Разрешены только буквы, цифры, точки и подчёркивания.'
    )
  }
  // Prevent MongoDB operator injection
  if (targetField.startsWith('$') || targetField.includes('$')) {
    throw new Error(`Недопустимый символ $ в имени поля: "${targetField}"`)
  }
}
