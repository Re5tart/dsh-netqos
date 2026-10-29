/**
 * dsh-netqos — 打游戏时给监听端（Coopanion / SnowLuma / DSH 自己）让带宽。
 *
 * 设置页「设置 → 网速守卫」：触发软件 + 限速值 → 写 ~/.dsh/netqos/config.json
 * 真正的限速由 SYSTEM 权限的助手任务（DSH NetQoS Helper）执行，本插件只读写配置与状态。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const DIR = path.join(DSH_HOME, 'netqos')
const CFG = path.join(DIR, 'config.json')
const STATE = path.join(DIR, 'state.txt')
const LOG = path.join(DIR, 'helper.log')
const BOOT = path.join(DIR, 'plugin-boot.log')

const DEFAULTS = { rateKBps: 128, targets: ['Coopanion.exe', 'SnowLuma.exe', 'DeepSeek Harness.exe'], apps: [] }

function bootStamp(m) {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.appendFileSync(BOOT, new Date().toISOString() + ' ' + m + '\n', 'utf8')
  } catch {}
}

function readConfig() {
  try {
    const j = JSON.parse(fs.readFileSync(CFG, 'utf8'))
    return {
      rateKBps: Number(j.rateKBps) > 0 ? Number(j.rateKBps) : DEFAULTS.rateKBps,
      targets: Array.isArray(j.targets) && j.targets.length ? j.targets.map(String) : DEFAULTS.targets,
      apps: Array.isArray(j.apps)
        ? j.apps.filter((a) => a && a.exe).map((a) => ({ exe: String(a.exe), action: a.action === 'pause' ? 'pause' : 'throttle' }))
        : [],
    }
  } catch {
    return { ...DEFAULTS, apps: [] }
  }
}

function writeConfig(c) {
  fs.mkdirSync(DIR, { recursive: true })
  const tmp = CFG + '.tmp' + process.pid
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2), 'utf8')
  fs.renameSync(tmp, CFG)
}

const EXE_RE = /^[\w.\- ]{1,64}\.exe$/i
function normApps(list) {
  const seen = new Set()
  const out = []
  for (const a of Array.isArray(list) ? list : []) {
    if (!a || typeof a.exe !== 'string') continue
    const exe = a.exe.trim()
    if (!EXE_RE.test(exe)) continue
    const key = exe.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ exe, action: a.action === 'pause' ? 'pause' : 'throttle' })
    if (out.length >= 40) break
  }
  return out
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE, 'utf8').replace(/^\uFEFF/, '').trim()
    if (!raw) return ''
    if (raw === 'idle') return '正常'
    if (raw.startsWith('throttled')) {
      const [, exe, action] = raw.split(/\s+/)
      return '限速中：' + exe + (action === 'pause' ? '（几乎断开）' : '')
    }
    return raw
  } catch {
    return ''
  }
}

function logTail(n = 8) {
  try {
    const lines = fs.readFileSync(LOG, 'utf8').replace(/^\uFEFF/, '').trim().split('\n')
    return lines.slice(-n)
  } catch {
    return []
  }
}

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = ''
    req.on('data', (d) => {
      s += d
      if (s.length > 200000) req.destroy()
    })
    req.on('end', () => resolve(s))
  })
}

function apply(ctx) {
  bootStamp('apply called')
  try {
    const trusted = (req) => {
      try {
        const conn = ctx.get('connection') || ctx.connection
        if (!conn || typeof conn.requestRejection !== 'function') return false
        const code = conn.requestRejection(req)
        return code === undefined || code === null || code === false
      } catch {
        return false
      }
    }

    const route = (kind, p, handler) => {
      ctx.webServer.register({
        kind,
        path: p,
        handler: async (req, res) => {
          if (!trusted(req)) {
            json(res, 403, { ok: false, error: '不受信任的访问来源' })
            return
          }
          try {
            await handler(req, res)
          } catch (e) {
            try {
              json(res, 500, { ok: false, error: String(e?.message ?? e) })
            } catch {}
          }
        },
      })
      bootStamp('route registered: ' + p)
    }

    route('exact', '/dsh-netqos/api/state', async (req, res) => {
      json(res, 200, { ok: true, config: readConfig(), state: readState(), log: logTail(), configPath: CFG })
    })

    route('exact', '/dsh-netqos/api/config', async (req, res) => {
      if (req.method === 'GET') {
        json(res, 200, { ok: true, config: readConfig() })
        return
      }
      if (req.method !== 'POST') {
        json(res, 405, { ok: false })
        return
      }
      const rawBody = await readBody(req)
      if (!rawBody.trim()) {
        json(res, 400, { ok: false, error: '请求体是空的' })
        return
      }
      let body
      try {
        body = JSON.parse(rawBody)
      } catch {
        json(res, 400, { ok: false, error: '请求体不是合法 JSON' })
        return
      }
      const cur = readConfig()
      const rate = Number(body.rateKBps)
      const next = {
        rateKBps: Number.isFinite(rate) && rate >= 8 ? Math.min(Math.round(rate), 10240) : cur.rateKBps,
        targets:
          Array.isArray(body.targets) && body.targets.length
            ? body.targets.map((t) => String(t).trim()).filter((t) => EXE_RE.test(t)).slice(0, 8)
            : cur.targets,
        apps: normApps(body.apps ?? cur.apps),
      }
      writeConfig(next)
      json(res, 200, { ok: true, config: next, savedAt: new Date().toISOString() })
    })
  } catch (e) {
    bootStamp('apply FAILED: ' + (e && e.message))
    throw e
  }
}

bootStamp('imported')

export default { name: 'dsh-netqos', inject: ['webServer'], apply }
