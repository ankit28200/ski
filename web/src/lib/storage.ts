import type { ChatTurn, StoredAnalysis } from './types'

const KEY = 'skinsense.history.v1'
const CHAT_KEY = 'skinsense.doctorChat.v1'

type ExportedUserDataV1 = {
  version: 1
  exportedAt: string
  history: StoredAnalysis[]
  chats: Record<string, ChatTurn[]>
}

function loadChatStore(): Record<string, ChatTurn[]> {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return {}
    return data as Record<string, ChatTurn[]>
  } catch {
    return {}
  }
}

function saveChatStore(store: Record<string, ChatTurn[]>) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(store))
}

export function loadDoctorChat(analysisId: string): ChatTurn[] {
  const store = loadChatStore()
  const turns = store[analysisId]
  if (!Array.isArray(turns)) return []

  const out: ChatTurn[] = []
  for (const t of turns) {
    if (!t || typeof t !== 'object') continue
    const role = (t as ChatTurn).role
    const text = (t as ChatTurn).text
    if ((role === 'user' || role === 'model') && typeof text === 'string') {
      out.push({ role, text })
    }
  }
  return out
}

export function saveDoctorChat(analysisId: string, turns: ChatTurn[]) {
  const store = loadChatStore()
  store[analysisId] = turns
  saveChatStore(store)
}

export function exportUserData(): ExportedUserDataV1 {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    history: loadHistory(),
    chats: loadChatStore(),
  }
}

function sanitizeTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return []

  const out: ChatTurn[] = []
  for (const t of raw) {
    if (!t || typeof t !== 'object') continue
    const role = (t as ChatTurn).role
    const text = (t as ChatTurn).text
    if ((role === 'user' || role === 'model') && typeof text === 'string') {
      out.push({ role, text })
    }
  }
  return out
}

function sanitizeChatStore(raw: unknown): Record<string, ChatTurn[]> {
  if (!raw || typeof raw !== 'object') return {}

  const out: Record<string, ChatTurn[]> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const turns = sanitizeTurns(v)
    if (turns.length > 0) out[k] = turns
  }
  return out
}

function sanitizeHistory(raw: unknown): StoredAnalysis[] {
  if (!Array.isArray(raw)) return []

  const out: StoredAnalysis[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const obj = it as StoredAnalysis
    if (typeof obj.id !== 'string' || typeof obj.createdAt !== 'string') continue
    if (!obj.response || typeof obj.response !== 'object') continue
    out.push({
      id: obj.id,
      createdAt: obj.createdAt,
      thumb: typeof obj.thumb === 'string' ? obj.thumb : undefined,
      response: obj.response,
    })
  }
  return out
}

export function importUserData(json: string): { importedHistory: number; importedChats: number } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }

  let historyRaw: unknown = null
  let chatsRaw: unknown = null

  if (Array.isArray(parsed)) {
    historyRaw = parsed
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    historyRaw = obj.history ?? obj.scans ?? obj.items
    chatsRaw = obj.chats ?? obj.chat
  }

  const incomingHistory = sanitizeHistory(historyRaw)
  const incomingChats = sanitizeChatStore(chatsRaw)

  const existing = loadHistory()
  const combined = [...existing, ...incomingHistory]
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.createdAt).getTime()
      const tb = new Date(b.createdAt).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })

  const seen = new Set<string>()
  const merged: StoredAnalysis[] = []
  for (const entry of combined) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    merged.push(entry)
  }

  localStorage.setItem(KEY, JSON.stringify(merged.slice(0, 25)))

  const chatStore = loadChatStore()
  for (const [analysisId, turns] of Object.entries(incomingChats)) {
    const existingTurns = chatStore[analysisId]
    if (!existingTurns || existingTurns.length < turns.length) {
      chatStore[analysisId] = turns
    }
  }
  saveChatStore(chatStore)

  return { importedHistory: incomingHistory.length, importedChats: Object.keys(incomingChats).length }
}

export function loadHistory(): StoredAnalysis[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as StoredAnalysis[]
    if (!Array.isArray(data)) return []
    return data
  } catch {
    return []
  }
}

export function saveToHistory(entry: StoredAnalysis) {
  const current = loadHistory()
  const next = [entry, ...current.filter((x) => x.id !== entry.id)].slice(0, 25)
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function clearHistory() {
  localStorage.removeItem(KEY)
  localStorage.removeItem(CHAT_KEY)
}
