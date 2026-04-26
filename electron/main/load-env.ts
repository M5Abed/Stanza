import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const dir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(dir, '../../.env') })
