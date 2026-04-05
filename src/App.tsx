import React, { useEffect, useState } from 'react'
import { Settings, PanelLeftClose, PanelLeft, Trash2 } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { SettingsPanel } from '@/components/Settings/SettingsPanel'
import { useProviderStore } from '@/store/providerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useChatStore } from '@/store/chatStore'
import { registerBuiltinSkills } from '@/skills'
import { providerRegistry } from '@/providers'

type SettingsTab = 'providers' | 'general' | 'skills' | 'mcp'

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('providers')

  const loadProviders = useProviderStore((s) => s.loadFromStorage)
  const loadSettings = useSettingsStore((s) => s.settings)
  const clearConversations = useChatStore((s) => s.clearConversations)

  useEffect(() => {
    registerBuiltinSkills()
    loadProviders()
  }, [])

  return (
    <div className="h-screen flex bg-surface-950 text-surface-100 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-700 bg-surface-900">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>

          <div className="flex-1" />

          <button
            onClick={() => {
              if (confirm('Clear all conversations?')) clearConversations()
            }}
            className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-800 transition-colors"
            title="Clear all"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => {
              setSettingsTab('providers')
              setSettingsOpen(true)
            }}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeTab={settingsTab}
      />
    </div>
  )
}

export default App
