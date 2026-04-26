import type { PrismaClient } from '@prisma/client'

const DEFAULT_TITLE_TERMS = [
  '(official video)',
  '(official music video)',
  '(lyrics)',
  '(lyric video)',
  '(audio)',
  '(hd)',
  '(4k)',
  '(remastered)',
  '(official)',
  '[official video]',
  '[lyrics]',
]

export async function seedDefaultCleaningTerms(db: PrismaClient): Promise<void> {
  const count = await db.titleCleaningTerm.count()
  if (count > 0) return

  await db.titleCleaningTerm.createMany({
    data: DEFAULT_TITLE_TERMS.map((term, i) => ({
      term,
      sortOrder: i,
      enabled: true,
    })),
  })
}
