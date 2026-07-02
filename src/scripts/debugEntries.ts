import { getPayload } from 'payload'

import config from '@payload-config'

const run = async () => {
  const payload = await getPayload({ config })
  const category = await payload.find({
    collection: 'competition-categories',
    limit: 1,
    where: { slug: { equals: 'roc-olympic-2026-badminton-men-single' } },
  })
  const categoryDoc = category.docs[0]
  console.log('category id:', categoryDoc?.id, typeof categoryDoc?.id)

  const entries = await payload.find({
    collection: 'competition-entries',
    limit: 50,
    depth: 0,
    where: { category_id: { equals: categoryDoc?.id } },
  })
  console.log('entries found via direct where:', entries.docs.length)
  for (const entry of entries.docs) {
    console.log('-', entry.display_name, entry.status, entry.seed_number, 'category_id=', entry.category_id, typeof entry.category_id)
  }

  const futsalCategory = await payload.find({
    collection: 'competition-categories',
    limit: 1,
    where: { slug: { equals: 'roc-olympic-2026-futsal-men' } },
  })
  const futsalEntries = await payload.find({
    collection: 'competition-entries',
    limit: 50,
    depth: 0,
    where: { category_id: { equals: futsalCategory.docs[0]?.id } },
  })
  console.log('futsal entries:', futsalEntries.docs.length)
  for (const entry of futsalEntries.docs) {
    console.log('-', entry.display_name, entry.status)
  }
}

await run()
process.exit(0)
