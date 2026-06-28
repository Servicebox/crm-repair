/**
 * Seed PlanConfig collection with the three subscription tiers.
 *
 * Run:
 *   TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node -r tsconfig-paths/register scripts/seed-plans.ts
 *
 * Requires MONGODB_URI in environment (or .env.local exported).
 */
import mongoose from 'mongoose'
import PlanConfig from '../src/models/PlanConfig'

const PLANS = [
  {
    slug: 'start',
    name: 'Старт',
    priceMonthly: 299000,   // 2 990 ₽
    priceYearly: 2990000,   // 29 900 ₽
    maxUsers: 3,
    maxLocations: 1,
    features: ['orders', 'clients', 'basic_reports'],
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: 'pro',
    name: 'Про',
    priceMonthly: 599000,   // 5 990 ₽
    priceYearly: 5990000,   // 59 900 ₽
    maxUsers: 10,
    maxLocations: 3,
    features: ['orders', 'clients', 'reports', 'warehouse', 'payroll'],
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: 'business',
    name: 'Бизнес',
    priceMonthly: 999000,   // 9 990 ₽
    priceYearly: 9990000,   // 99 900 ₽
    maxUsers: 50,
    maxLocations: 10,
    features: ['orders', 'clients', 'reports', 'warehouse', 'payroll', 'chat', 'analytics'],
    isActive: true,
    sortOrder: 3,
  },
]

async function seed() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  for (const plan of PLANS) {
    await PlanConfig.findOneAndUpdate(
      { slug: plan.slug },
      { $set: plan },
      { upsert: true, new: true }
    )
    console.log(`Upserted plan: ${plan.slug} (${plan.name})`)
  }

  await mongoose.disconnect()
  console.log('Seed complete')
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
