import { create } from 'zustand'
import { EvaluationSession, EvaluationRecord, EvaluationSummary } from '@/types/evaluation'
import { loadEvaluations, saveEvaluations } from '@/services/storage'
import { generateId } from '@/utils/helpers'

interface EvaluationState {
  sessions: EvaluationSession[]
  activeSessionId: string | null
  isRunning: boolean
  currentProgress: { completed: number; total: number } | null
  phase: 'idle' | 'generating' | 'answering' | 'judging' | 'done'

  getActiveSession: () => EvaluationSession | undefined
  createSession: (name: string) => string
  deleteSession: (id: string) => void
  setActiveSession: (id: string | null) => void
  addRecord: (sessionId: string, record: EvaluationRecord) => void
  updateRecordNotes: (sessionId: string, recordId: string, notes: string) => void
  deleteRecord: (sessionId: string, recordId: string) => void
  updateSessionSummary: (sessionId: string, summary: EvaluationSummary) => void
  setRunning: (running: boolean) => void
  setProgress: (progress: { completed: number; total: number } | null) => void
  setPhase: (phase: EvaluationState['phase']) => void
  persist: () => void
}

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  sessions: loadEvaluations(),
  activeSessionId: null,
  isRunning: false,
  currentProgress: null,
  phase: 'idle',

  getActiveSession: () => {
    const { sessions, activeSessionId } = get()
    return sessions.find((s) => s.id === activeSessionId)
  },

  createSession: (name) => {
    const id = generateId()
    const session: EvaluationSession = {
      id,
      name,
      records: [],
      summary: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: id,
    }))
    get().persist()
    return id
  },

  deleteSession: (id) => {
    set((s) => ({
      sessions: s.sessions.filter((ses) => ses.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    }))
    get().persist()
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  addRecord: (sessionId, record) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId
          ? { ...ses, records: [...ses.records, record], updatedAt: Date.now() }
          : ses
      ),
    }))
    get().persist()
  },

  updateRecordNotes: (sessionId, recordId, notes) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId
          ? {
              ...ses,
              records: ses.records.map((r) => (r.id === recordId ? { ...r, notes } : r)),
              updatedAt: Date.now(),
            }
          : ses
      ),
    }))
    get().persist()
  },

  deleteRecord: (sessionId, recordId) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId
          ? { ...ses, records: ses.records.filter((r) => r.id !== recordId), updatedAt: Date.now() }
          : ses
      ),
    }))
    get().persist()
  },

  updateSessionSummary: (sessionId, summary) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId ? { ...ses, summary, updatedAt: Date.now() } : ses
      ),
    }))
    get().persist()
  },

  setRunning: (running) => set({ isRunning: running }),
  setProgress: (progress) => set({ currentProgress: progress }),
  setPhase: (phase) => set({ phase }),

  persist: () => {
    const { sessions } = get()
    saveEvaluations(sessions)
  },
}))
