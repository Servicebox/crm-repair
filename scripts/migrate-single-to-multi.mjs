/**
 * One-time migration: assign companyId to all existing users and add
 * slug/dbName to the existing Company record.
 *
 * Run: node scripts/migrate-single-to-multi.mjs
 */
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env.local') })

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env.local')
  process.exit(1)
}

// Extract DB name from URI
const dbNameMatch = MONGODB_URI.match(/\/([^/?]+)(\?.*)?$/)
const defaultDbName = dbNameMatch?.[1] ?? 'crm_repair'
console.log(`Platform DB: ${defaultDbName}`)

await mongoose.connect(MONGODB_URI)
const db = mongoose.connection

// --- Fix Company ---
const companies = await db.collection('companies').find({}).toArray()
console.log(`Found ${companies.length} company record(s)`)

let company
if (companies.length === 0) {
  company = await db.collection('companies').insertOne({
    name: 'Мой сервисный центр',
    slug: 'default',
    dbName: defaultDbName,
    isActive: true,
    orderCounter: 0,
    defaultWarrantyDays: 30,
    defaultReadyDays: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  console.log('Created default company')
} else {
  company = companies[0]
  if (!company.slug || !company.dbName) {
    await db.collection('companies').updateOne(
      { _id: company._id },
      { $set: { slug: 'default', dbName: defaultDbName, isActive: true } }
    )
    console.log(`Updated company "${company.name}": slug=default, dbName=${defaultDbName}`)
  } else {
    console.log(`Company already has slug="${company.slug}", dbName="${company.dbName}"`)
  }
  company = await db.collection('companies').findOne({ _id: company._id })
}

const companyId = company._id

// --- Fix Users ---
const usersWithoutCompany = await db.collection('users').find({ companyId: { $exists: false } }).toArray()
console.log(`Users without companyId: ${usersWithoutCompany.length}`)

if (usersWithoutCompany.length > 0) {
  const result = await db.collection('users').updateMany(
    { companyId: { $exists: false } },
    { $set: { companyId } }
  )
  console.log(`Updated ${result.modifiedCount} users with companyId=${companyId}`)
}

await mongoose.disconnect()
console.log('\nMigration complete.')
