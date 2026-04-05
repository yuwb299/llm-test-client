import { create } from 'zustand'
import { AppSettings } from '@/types'
import { loadSettings, saveSettings } from '@/services/storage'
import { defaultSettings } from '@/config/defaults'

interface SettingsState {
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...defaultSettings, ...loadSettings() },

  updateSettings: (updates) => {
    set((s) => {
      const settings = { ...s.settings, ...updates }
      saveSettings(settings)
      return { settings }
    })
  },

  resetSettings: () => {
    set({ settings: defaultSettings })
    saveSettings(defaultSettings)
  },
}))
