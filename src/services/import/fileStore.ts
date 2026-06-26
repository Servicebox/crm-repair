import fs from 'fs'
import path from 'path'

function getBase(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), 'data', 'uploads')
}

/**
 * Returns the canonical upload directory for a given import job.
 * Sanitizes both IDs by stripping path separators and applying path.basename
 * to remove any remaining directory-traversal segments.
 */
export function uploadDir(companyId: string, jobId: string): string {
  // path.basename removes any directory-traversal segments
  const safeCompany = path.basename(companyId.replace(/[/\\]/g, '_'))
  const safeJob = path.basename(jobId.replace(/[/\\]/g, '_'))
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
