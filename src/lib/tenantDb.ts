import mongoose from 'mongoose'

declare global {
  // eslint-disable-next-line no-var
  var tenantConnections: Map<string, mongoose.Connection> | undefined
}

const cache: Map<string, mongoose.Connection> = global.tenantConnections ?? new Map()
if (!global.tenantConnections) global.tenantConnections = cache

function buildTenantUri(dbName: string): string {
  const uri = process.env.MONGODB_URI!
  // Replace the last path segment (db name) before optional query string
  return uri.replace(/\/([^/?]+)(\?.*)?$/, `/${dbName}$2`)
}

export async function getTenantConnection(dbName: string): Promise<mongoose.Connection> {
  const existing = cache.get(dbName)
  if (existing && existing.readyState === 1) return existing

  const uri = buildTenantUri(dbName)
  const conn = await mongoose.createConnection(uri, { bufferCommands: false }).asPromise()
  cache.set(dbName, conn)
  return conn
}

export function getDefaultDbName(): string {
  const uri = process.env.MONGODB_URI!
  const match = uri.match(/\/([^/?]+)(\?.*)?$/)
  return match?.[1] ?? 'crm_repair'
}
