import fs from 'fs'
import path from 'path'

function getBase(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), 'data', 'uploads')
}

/**
 * Returns the canonical upload directory for a given import job.
 * Guaranteed to be under the upload base — no path traversal possible.
 */
export function uploadDir(companyId: string, jobId: string): string {
  // Strip any path separators from IDs to prevent traversal
  const safeCompany = companyId.replace(/[/\\]/g, '_')
  const safeJob = jobId.replace(/[/\\]/g, '_')
  return path.join(getBase(), safeCompany, safeJob)
}

/**
 * Asserts that `filePath` exists and is readable.
 * Throws a user-friendly error (not a raw ENOENT) if not.
 */
export function assertReadable(filePath: string): void {
  try {
    fs.accessSync(filePath, fs.constants.R_OK)
  } catch {
    const name = path.basename(filePath)
    throw new Error(
      `Файл импорта не найден: ${name}. ` +
      'Возможно, файл был удалён из временного хранилища. Загрузите файл заново.'
    )
  }
}
