import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import webpush from 'web-push'

const DEFAULT_MAX_SOURCES = 200

export interface Config {
  host: string
  port: number
  // Signs the session cookies: made on the first start and kept next to the database.
  sessionSecret: Buffer
  webDir: string
  sourcesFile: string
  // SQLite database and its daily backups.
  databaseFile: string
  backupDir: string
  // The server's own time zone, the household's until it picks one.
  timeZone: string
  // The key pair that signs notifications: VAPID_* when set (an install from before), else made on the first
  // start and kept next to the database.
  vapid: { publicKey: string; privateKey: string; subject: string }
  // The household's sources, all profiles together (MAX_SOURCES, 200 by default): each one is fetched.
  maxSources: number
}

// Push services want a way to reach whoever sends: the project's page will do.
const DEFAULT_VAPID_SUBJECT = 'https://github.com/Anthodpnt/hodi-app'

// The database had another name before the app became Hodi: it is renamed, with its write-ahead log, on the first
// start that finds it alone.
const DATABASE_NAME = 'hodi.db'
const LEGACY_DATABASE_NAME = 'bref.db'

const databaseIn = (dataDir: string) => {
  const file = path.resolve(dataDir, DATABASE_NAME)
  const legacy = path.resolve(dataDir, LEGACY_DATABASE_NAME)
  if (!fs.existsSync(file) && fs.existsSync(legacy)) {
    for (const suffix of ['-wal', '-shm', '']) {
      if (fs.existsSync(legacy + suffix)) fs.renameSync(legacy + suffix, file + suffix)
    }
  }
  return file
}

// Written once, readable by the server only; a second start reads it back.
const keptFile = (file: string, make: () => string) => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, make(), { mode: 0o600, flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  return fs.readFileSync(file, 'utf8').trim()
}

const loadVapid = (env: NodeJS.ProcessEnv, file: string): Config['vapid'] => {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  const subject = env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT
  if (!/^(mailto:|https:\/\/)/.test(subject)) throw new Error('VAPID_SUBJECT must start with mailto: or https://')
  if (publicKey && privateKey) return { publicKey, privateKey, subject }

  const stored = JSON.parse(keptFile(file, () => JSON.stringify(webpush.generateVAPIDKeys()))) as {
    publicKey?: unknown
    privateKey?: unknown
  }
  if (typeof stored.publicKey !== 'string' || typeof stored.privateKey !== 'string') {
    throw new Error(`${file} must hold a publicKey and a privateKey`)
  }
  return { publicKey: stored.publicKey, privateKey: stored.privateKey, subject }
}

// Removing the file signs out every device.
const loadSessionSecret = (file: string) => {
  const stored = keptFile(file, () => randomBytes(32).toString('hex'))
  if (!/^[0-9a-f]{64,}$/i.test(stored)) throw new Error(`${file} must hold at least 64 hex characters`)
  return Buffer.from(stored, 'hex')
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const port = Number(env.PORT ?? 3000)
  const dataDir = env.DATA_DIR?.trim() || 'data'

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port')
  }

  const maxSources = Number(env.MAX_SOURCES ?? DEFAULT_MAX_SOURCES)
  if (!Number.isInteger(maxSources) || maxSources < 1) {
    throw new Error('MAX_SOURCES must be a whole number above 0')
  }

  return {
    host: env.HOST ?? '127.0.0.1',
    port,
    sessionSecret: loadSessionSecret(path.resolve(dataDir, 'session-secret')),
    webDir: env.WEB_DIR ?? path.resolve(import.meta.dirname, '../web'),
    sourcesFile: path.resolve(env.SOURCES_FILE ?? 'sources.yml'),
    databaseFile: databaseIn(dataDir),
    backupDir: path.resolve(dataDir, 'backups'),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    vapid: loadVapid(env, path.resolve(dataDir, 'vapid.json')),
    maxSources
  }
}
