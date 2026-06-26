import { describe, it, expect } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { uploadDir, assertReadable } from '../fileStore'

describe('uploadDir', () => {
  it('returns a path scoped to companyId and jobId', () => {
    const dir = uploadDir('company123', 'job456')
    expect(dir).toContain('company123')
    expect(dir).toContain('job456')
  })

  it('different companies get different directories', () => {
    const a = uploadDir('companyA', 'job1')
    const b = uploadDir('companyB', 'job1')
    expect(a).not.toBe(b)
  })

  it('path does not contain ".." (no path traversal)', () => {
    // Even if someone passes a crafted companyId
    const dir = uploadDir('../../../etc', 'job1')
    const resolved = path.resolve(dir)
    const base = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads'))
    expect(resolved.startsWith(base)).toBe(true)
  })
})

describe('assertReadable', () => {
  it('does not throw for an existing readable file', () => {
    const tmp = path.join(os.tmpdir(), `assert-test-${Date.now()}.txt`)
    fs.writeFileSync(tmp, 'ok')
    expect(() => assertReadable(tmp)).not.toThrow()
    fs.unlinkSync(tmp)
  })

  it('throws with a clear message for a missing file', () => {
    expect(() => assertReadable('/tmp/does-not-exist-xyzzy.xlsx')).toThrow(
      /Файл импорта не найден/
    )
  })

  it('includes the filename in the error message', () => {
    expect(() => assertReadable('/tmp/missing-file.xlsx')).toThrow(/missing-file\.xlsx/)
  })
})
