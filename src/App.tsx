import React, { useEffect, useState } from 'react'
import { Settings, PanelLeftClose, PanelLeft, Trash2, MessageSquare, FlaskConical, ScrollText } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { ChatPanel } from '@/components/Chat/ChatPanel'
import { SettingsPanel } from '@/components/Settings/SettingsPanel'
import { EvaluationPanel } from '@/components/Evaluation/EvaluationPanel'
import { LogPanel } from '@/components/Log/LogPanel'
import { useProviderStore } from '@/store/providerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useChatStore } from '@/store/chatStore'
import { registerBuiltinSkills } from '@/skills'
import { providerRegistry } from '@/providers'

type MainTab = 'chat' | 'evaluation' | 'logs'
type SettingsTab = 'providers' | 'general' | 'skills' | 'mcp'

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('providers')
  const [mainTab, setMainTab] = useState<MainTab>('chat')

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

          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setMainTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mainTab === 'chat'
                  ? 'bg-surface-700 text-primary-300'
                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800'
              }`}
            >
              <MessageSquare size={14} />
              对话
            </button>
            <button
              onClick={() => setMainTab('evaluation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mainTab === 'evaluation'
                  ? 'bg-surface-700 text-primary-300'
                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800'
              }`}
            >
              <FlaskConical size={14} />
              模型评估
            </button>
            <button
              onClick={() => setMainTab('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mainTab === 'logs'
                  ? 'bg-surface-700 text-primary-300'
                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800'
              }`}
            >
              <ScrollText size={14} />
              交互日志
            </button>
          </div>

          <div className="flex-1" />

          {mainTab === 'chat' && (
            <button
              onClick={() => {
                if (confirm('Clear all conversations?')) clearConversations()
              }}
              className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-800 transition-colors"
              title="Clear all"
            >
              <Trash2 size={16} />
            </button>
          )}
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
          {mainTab === 'chat' ? <ChatPanel /> : mainTab === 'evaluation' ? <EvaluationPanel /> : <LogPanel />}
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
