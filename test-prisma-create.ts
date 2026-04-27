import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

async function test() {
  const dbPath = path.join(process.cwd(), 'test-no-exist.db')
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

  const url = `file:${dbPath.replace(/\\/g, '/')}`
  console.log('Testing URL:', url)
  process.env.DATABASE_URL = url
  
  const prisma = new PrismaClient({ log: ['info', 'error'] })
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Test" ("id" INTEGER PRIMARY KEY)`)
    console.log('Success!')
  } catch (e) {
    console.error('Failed because file does not exist:', e)
  } finally {
    await prisma.$disconnect()
  }
}

test()
