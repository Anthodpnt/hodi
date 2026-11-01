import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { loadConfig } from '../config.ts'

const env = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  DATA_DIR: mkdtempSync(path.join(tmpdir(), 'hodi-config-')),
  ...extra
})

describe('config', () => {
  it('starts with nothing set, making its secrets on the first start and keeping them', () => {
    const first = env()
    const config = loadConfig(first)
    assert.equal(config.sessionSecret.length, 32)

    const file = path.join(first.DATA_DIR!, 'session-secret')
    assert.equal(statSync(file).mode & 0o777, 0o600)
    assert.equal(readFileSync(file, 'utf8'), config.sessionSecret.toString('hex'))

    const vapid = path.join(first.DATA_DIR!, 'vapid.json')
    assert.equal(statSync(vapid).mode & 0o777, 0o600)
    assert.match(config.vapid.subject, /^https:\/\//)

    const again = loadConfig(first)
    assert.deepEqual(again.sessionSecret, config.sessionSecret)
    assert.deepEqual(again.vapid, config.vapid)
  })

  it('keeps the notification keys of an install from before', () => {
    const { vapid } = loadConfig(
      env({ VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private', VAPID_SUBJECT: 'mailto:me@example.com' })
    )
    assert.deepEqual(vapid, { publicKey: 'public', privateKey: 'private', subject: 'mailto:me@example.com' })
    assert.throws(() => loadConfig(env({ VAPID_SUBJECT: 'me@example.com' })), /VAPID_SUBJECT/)
  })

  it('renames the database of an install from before Hodi, with its log', () => {
    const before = env()
    writeFileSync(path.join(before.DATA_DIR!, 'bref.db'), 'data')
    writeFileSync(path.join(before.DATA_DIR!, 'bref.db-wal'), 'log')

    const { databaseFile } = loadConfig(before)

    assert.equal(databaseFile, path.join(before.DATA_DIR!, 'hodi.db'))
    assert.equal(readFileSync(databaseFile, 'utf8'), 'data')
    assert.equal(readFileSync(`${databaseFile}-wal`, 'utf8'), 'log')
    assert.equal(existsSync(path.join(before.DATA_DIR!, 'bref.db')), false)
  })

  it('leaves an old database alone once the new one exists', () => {
    const both = env()
    writeFileSync(path.join(both.DATA_DIR!, 'bref.db'), 'old')
    writeFileSync(path.join(both.DATA_DIR!, 'hodi.db'), 'new')

    assert.equal(readFileSync(loadConfig(both).databaseFile, 'utf8'), 'new')
  })
})
