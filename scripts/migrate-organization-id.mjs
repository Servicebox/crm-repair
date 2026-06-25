/**
 * Backfill organization_id on legacy records.
 *
 * Architecture: each Company has its own MongoDB database (crm_<slug>).
 * This script iterates every active company, connects to its tenant DB,
 * and stamps organization_id on documents in orders, clients, devices, parts
 * that are missing the field — in batches of 500 to avoid memory pressure.
 *
 * Usage:
 *   node scripts/migrate-organization-id.mjs
 *   node scripts/migrate-organization-id.mjs --dry-run
 */

import 'dotenv/config'
import mongoose from 'mongoose'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500

const TENANT_COLLECTIONS = ['orders', 'clients', 'devices', 'parts']

// ── helpers ──────────────────────────────────────────────────────────────────

function buildUri(baseUri, dbName) {
  return baseUri.replace(/\/([^/?]+)(\?.*)?$/, `/${dbName}$2`)
}

async function getTenantConnection(baseUri, dbName) {
  const uri = buildUri(baseUri, dbName)
  const conn = await mongoose.createConnection(uri, { bufferCommands: false }).asPromise()
  return conn
}

async function backfillCollection(db, collectionName, organizationId) {
  const col = db.collection(collectionName)
  const filter = { organization_id: { $exists: false } }
  const total = await col.countDocuments(filter)

  if (total === 0) {
    console.log(`  ${collectionName}: already fully backfilled`)
    return { updated: 0 }
  }

  console.log(`  ${collectionName}: ${total} documents to backfill`)

  if (DRY_RUN) {
    console.log(`  ${collectionName}: [DRY RUN] would update ${total} docs`)
    return { updated: 0 }
  }

  let processed = 0
  let cursor = col.find(filter, { projection: { _id: 1 } })

  while (true) {
    const batch = await cursor.limit(BATCH_SIZE).toArray()
    if (batch.length === 0) break

    const ids = batch.map(d => d._id)
    const ops = ids.map(id => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { organization_id: new mongoose.Types.ObjectId(organizationId) } },
      },
    }))

    const result = await col.bulkWrite(ops, { ordered: false })
    processed += result.modifiedCount

    // Advance cursor past the batch we just processed
    cursor = col.find(filter, { projection: { _id: 1 } })
    if (processed >= total) break
  }

  return { updated: processed }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const baseUri = process.env.MONGODB_URI
  if (!baseUri) throw new Error('MONGODB_URI is not set')

  console.log(`Migration: backfill organization_id${DRY_RUN ? ' [DRY RUN]' : ''}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log()

  const platformConn = await mongoose.createConnection(baseUri, { bufferCommands: false }).asPromise()

  const companies = await platformConn.db
    .collection('companies')
    .find({ isActive: { $ne: false }, dbName: { $exists: true } }, { projection: { _id: 1, name: 1, dbName: 1 } })
    .toArray()

  console.log(`Found ${companies.length} active companies with tenant DBs\n`)

  const summary = []

  for (const company of companies) {
    console.log(`→ Company: "${company.name}" (${company.dbName})`)
    let tenantConn

    try {
      tenantConn = await getTenantConnection(baseUri, company.dbName)

      const companyStats = {}
      for (const col of TENANT_COLLECTIONS) {
        const stats = await backfillCollection(tenantConn.db, col, company._id.toString())
        companyStats[col] = stats.updated
      }

      summary.push({ name: company.name, dbName: company.dbName, ...companyStats })
    } catch (err) {
      console.error(`  ERROR processing ${company.dbName}: ${err.message}`)
      summary.push({ name: company.name, dbName: company.dbName, error: err.message })
    } finally {
      await tenantConn?.close()
    }

    console.log()
  }

  await platformConn.close()

  console.log('─'.repeat(60))
  console.log('Summary:')
  for (const row of summary) {
    if (row.error) {
      console.log(`  ${row.name}: ERROR — ${row.error}`)
    } else {
      const counts = TENANT_COLLECTIONS.map(c => `${c}:${row[c]}`).join(', ')
      console.log(`  ${row.name}: ${counts}`)
    }
  }
  console.log()
  console.log(DRY_RUN ? 'Dry run complete — no data was modified.' : 'Migration complete.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
