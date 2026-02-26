import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addPortfolioCurrency() {
  try {
    console.log(
      'Starting migration to add USD currency to portfolios without currency...\n'
    )

    // Update portfolios where currency field doesn't exist
    console.log('Updating portfolios where currency field does not exist...')
    const resultNoField = await prisma.$runCommandRaw({
      update: 'Portfolio',
      updates: [
        {
          q: { currency: { $exists: false } },
          u: { $set: { currency: 'USD' } },
          multi: true
        }
      ]
    })
    console.log('Result (currency field missing):', resultNoField)

    // Update portfolios where currency is null
    console.log('\nUpdating portfolios where currency is null...')
    const resultNull = await prisma.$runCommandRaw({
      update: 'Portfolio',
      updates: [
        {
          q: { currency: null },
          u: { $set: { currency: 'USD' } },
          multi: true
        }
      ]
    })
    console.log('Result (currency is null):', resultNull)

    // Update portfolios where currency is empty string
    console.log('\nUpdating portfolios where currency is empty string...')
    const resultEmpty = await prisma.$runCommandRaw({
      update: 'Portfolio',
      updates: [
        {
          q: { currency: '' },
          u: { $set: { currency: 'USD' } },
          multi: true
        }
      ]
    })
    console.log('Result (currency is empty):', resultEmpty)

    console.log('\nMigration completed successfully!')
  } catch (error) {
    console.error('Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addPortfolioCurrency().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
