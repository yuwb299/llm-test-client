import { create } from 'zustand'
import { InteractionLog } from '@/types/log'
import { loadLogs, saveLogs } from '@/services/storage'

const MAX_LOGS = 500

interface LogState {
  logs: InteractionLog[]
  addLog: (log: InteractionLog) => void
  clearLogs: () => void
  deleteLog: (id: string) => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: loadLogs(),

  addLog: (log) => {
    set((state) => {
      const logs = [log, ...state.logs].slice(0, MAX_LOGS)
      saveLogs(logs)
      return { logs }
    })
  },

  clearLogs: () => {
    set({ logs: [] })
    saveLogs([])
  },

  deleteLog: (id) => {
    set((state) => {
      const logs = state.logs.filter((l) => l.id !== id)
      saveLogs(logs)
      return { logs }
    })
  },
}))
