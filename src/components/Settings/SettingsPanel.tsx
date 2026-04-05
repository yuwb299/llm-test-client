import React, { useState } from 'react'
import { X, Save, Eye, EyeOff, Plus, Trash2, Edit2, Check } from 'lucide-react'
import { ProviderConfig, ModelInfo } from '@/types/provider'
import { useProviderStore } from '@/store/providerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { generateId } from '@/utils/helpers'
import { skillRegistry } from '@/skills'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  activeTab: 'providers' | 'general' | 'skills' | 'mcp'
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, activeTab: initialTab }) => {
  const [tab, setTab] = useState(initialTab)
  const providers = useProviderStore((s) => s.providers)
  const updateProvider = useProviderStore((s) => s.updateProvider)
  const addProvider = useProviderStore((s) => s.addProvider)
  const removeProvider = useProviderStore((s) => s.removeProvider)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <h3 className="text-sm font-semibold text-surface-200">Settings</h3>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-surface-700">
          {(['providers', 'general', 'skills', 'mcp'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'text-primary-400 border-b-2 border-primary-400' : 'text-surface-500 hover:text-surface-300'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'providers' && (
            <ProviderSettings
              providers={providers}
              onUpdate={updateProvider}
              onAdd={addProvider}
              onRemove={removeProvider}
            />
          )}
          {tab === 'general' && <GeneralSettings />}
          {tab === 'skills' && <SkillsSettings />}
          {tab === 'mcp' && <MCPSettings />}
        </div>
      </div>
    </div>
  )
}

const ProviderSettings: React.FC<{
  providers: ProviderConfig[]
  onUpdate: (id: string, updates: Partial<ProviderConfig>) => void
  onAdd: (provider: ProviderConfig) => void
  onRemove: (id: string) => void
}> = ({ providers, onUpdate, onAdd, onRemove }) => {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [newProvider, setNewProvider] = useState(false)

  return (
    <div className="space-y-4">
      {providers.map((p) => (
        <div key={p.id} className="border border-surface-700 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) => onUpdate(p.id, { enabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-surface-200">{p.name}</span>
              <span className="text-xs text-surface-600 px-1.5 py-0.5 bg-surface-700 rounded">{p.type}</span>
            </div>
            <button onClick={() => onRemove(p.id)} className="text-surface-600 hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-surface-500 mb-1 block">API Base URL</label>
              <input
                value={p.apiBaseUrl}
                onChange={(e) => onUpdate(p.id, { apiBaseUrl: e.target.value })}
                className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-surface-500 mb-1 block">API Key</label>
              <div className="relative">
                <input
                  type={showKey[p.id] ? 'text' : 'password'}
                  value={p.apiKey}
                  onChange={(e) => onUpdate(p.id, { apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 pr-8 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
                />
                <button
                  onClick={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-surface-600 hover:text-surface-400"
                >
                  {showKey[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-surface-500">Models ({p.models.length})</label>
              <button
                onClick={() => {
                  const newModel: ModelInfo = {
                    id: '',
                    name: '',
                    maxTokens: 4096,
                    supportsVision: false,
                    supportsAudio: false,
                    supportsStreaming: true,
                    supportsToolUse: false,
                    supportsJsonMode: false,
                  }
                  onUpdate(p.id, { models: [...p.models, newModel] })
                }}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                <Plus size={12} />
                Add Model
              </button>
            </div>
            <div className="space-y-1.5">
              {p.models.map((m, idx) => (
                <ModelItem
                  key={`model-${p.id}-${idx}`}
                  initialModel={m}
                  onSave={(updated) => {
                    const models = [...p.models]
                    models[idx] = updated
                    onUpdate(p.id, { models })
                  }}
                  onRemove={() => {
                    onUpdate(p.id, { models: p.models.filter((_, i) => i !== idx) })
                  }}
                />
              ))}
              {p.models.length === 0 && (
                <div className="text-xs text-surface-600 text-center py-2">No models configured</div>
              )}
            </div>
          </div>
        </div>
      ))}

      {newProvider ? (
        <NewProviderForm
          onSave={(provider) => {
            onAdd(provider)
            setNewProvider(false)
          }}
          onCancel={() => setNewProvider(false)}
        />
      ) : (
        <button
          onClick={() => setNewProvider(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-surface-700 rounded-lg text-sm text-surface-500 hover:text-surface-300 hover:border-surface-600 transition-colors"
        >
          <Plus size={14} />
          Add Custom Provider
        </button>
      )}
    </div>
  )
}

const ModelItem: React.FC<{
  initialModel: ModelInfo
  onSave: (model: ModelInfo) => void
  onRemove: () => void
}> = ({ initialModel, onSave, onRemove }) => {
  const [editing, setEditing] = useState(!initialModel.id)
  const [draft, setDraft] = useState<ModelInfo>({ ...initialModel })
  const [inputPrice, setInputPrice] = useState(initialModel.pricing?.inputPerMillion?.toString() ?? '')
  const [outputPrice, setOutputPrice] = useState(initialModel.pricing?.outputPerMillion?.toString() ?? '')

  if (editing) {
    return (
      <div className="bg-surface-900 border border-surface-700 rounded-lg p-2.5 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-surface-600 block mb-0.5">Model ID</label>
            <input
              value={draft.id}
              onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
              placeholder="e.g. gemma4:31b"
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-600 block mb-0.5">Display Name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Gemma 4 31B"
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-600 block mb-0.5">Max Tokens</label>
            <input
              type="number"
              value={draft.maxTokens}
              onChange={(e) => setDraft((d) => ({ ...d, maxTokens: parseInt(e.target.value) || 4096 }))}
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-end">
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.supportsVision}
                onChange={(e) => setDraft((d) => ({ ...d, supportsVision: e.target.checked }))}
              />
              Vision
            </label>
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.supportsStreaming}
                onChange={(e) => setDraft((d) => ({ ...d, supportsStreaming: e.target.checked }))}
              />
              Stream
            </label>
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.supportsToolUse}
                onChange={(e) => setDraft((d) => ({ ...d, supportsToolUse: e.target.checked }))}
              />
              Tools
            </label>
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.supportsJsonMode}
                onChange={(e) => setDraft((d) => ({ ...d, supportsJsonMode: e.target.checked }))}
              />
              JSON
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <div>
              <label className="text-xs text-surface-600 block mb-0.5">Input $/M tokens</label>
              <input
                type="number"
                step="0.01"
                value={inputPrice}
                onChange={(e) => setInputPrice(e.target.value)}
                placeholder="0"
                className="w-24 bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-surface-600 block mb-0.5">Output $/M tokens</label>
              <input
                type="number"
                step="0.01"
                value={outputPrice}
                onChange={(e) => setOutputPrice(e.target.value)}
                placeholder="0"
                className="w-24 bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                if (!draft.id) return
                const inp = parseFloat(inputPrice)
                const out = parseFloat(outputPrice)
                const pricing = (!isNaN(inp) || !isNaN(out))
                  ? { inputPerMillion: isNaN(inp) ? 0 : inp, outputPerMillion: isNaN(out) ? 0 : out }
                  : undefined
                onSave({ ...draft, pricing })
                setEditing(false)
              }}
              className="p-1 text-surface-500 hover:text-green-400 transition-colors"
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={onRemove}
              className="p-1 text-surface-500 hover:text-red-400 transition-colors"
              title="Remove"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between bg-surface-900 border border-surface-700 rounded px-2.5 py-1.5 group">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-surface-300 truncate">{initialModel.name || initialModel.id}</span>
        <span className="text-xs text-surface-600 shrink-0">{(initialModel.maxTokens / 1000).toFixed(0)}K</span>
        {initialModel.supportsVision && <span className="text-xs" title="Vision">👁</span>}
        {initialModel.pricing && (
          <span className="text-xs text-surface-600 shrink-0">
            ${initialModel.pricing.inputPerMillion}/${initialModel.pricing.outputPerMillion}
          </span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => {
            setDraft({ ...initialModel })
            setInputPrice(initialModel.pricing?.inputPerMillion?.toString() ?? '')
            setOutputPrice(initialModel.pricing?.outputPerMillion?.toString() ?? '')
            setEditing(true)
          }}
          className="p-1 text-surface-500 hover:text-primary-400"
          title="Edit"
        >
          <Edit2 size={12} />
        </button>
        <button onClick={onRemove} className="p-1 text-surface-500 hover:text-red-400" title="Remove">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

const NewProviderForm: React.FC<{
  onSave: (provider: ProviderConfig) => void
  onCancel: () => void
}> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')

  return (
    <div className="border border-surface-700 rounded-lg p-3 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Provider Name"
        className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
      />
      <input
        value={apiBaseUrl}
        onChange={(e) => setApiBaseUrl(e.target.value)}
        placeholder="API Base URL"
        className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
      />
      <input
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="API Key"
        type="password"
        className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 px-2 py-1.5 bg-surface-700 rounded text-sm text-surface-300 hover:bg-surface-600">
          Cancel
        </button>
        <button
          onClick={() => {
            if (!name || !apiBaseUrl) return
            onSave({
              id: generateId(),
              name,
              type: 'custom',
              apiBaseUrl,
              apiKey,
              models: [],
              enabled: true,
            })
          }}
          className="flex-1 px-2 py-1.5 bg-primary-600 rounded text-sm text-white hover:bg-primary-500"
        >
          Add
        </button>
      </div>
    </div>
  )
}

const GeneralSettings: React.FC = () => {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  return (
    <div className="space-y-4">
      <SettingRow label="Theme">
        <select
          value={settings.theme}
          onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}
          className="bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </SettingRow>
      <SettingRow label="Send on Enter">
        <input
          type="checkbox"
          checked={settings.sendOnEnter}
          onChange={(e) => updateSettings({ sendOnEnter: e.target.checked })}
        />
      </SettingRow>
      <SettingRow label="Show Token Count">
        <input
          type="checkbox"
          checked={settings.showTokenCount}
          onChange={(e) => updateSettings({ showTokenCount: e.target.checked })}
        />
      </SettingRow>
      <SettingRow label="Show Timestamps">
        <input
          type="checkbox"
          checked={settings.showTimestamp}
          onChange={(e) => updateSettings({ showTimestamp: e.target.checked })}
        />
      </SettingRow>
      <SettingRow label="Stream Responses">
        <input
          type="checkbox"
          checked={settings.streamEnabled}
          onChange={(e) => updateSettings({ streamEnabled: e.target.checked })}
        />
      </SettingRow>
      <SettingRow label="Temperature">
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          className="flex-1"
        />
        <span className="text-sm text-surface-400 ml-2 w-8">{settings.temperature}</span>
      </SettingRow>
      <SettingRow label="Max Tokens">
        <input
          type="number"
          value={settings.maxTokens}
          onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
          className="w-24 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300"
        />
      </SettingRow>
      <SettingRow label="Font Size">
        <input
          type="number"
          min="12"
          max="20"
          value={settings.fontSize}
          onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) || 14 })}
          className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300"
        />
      </SettingRow>
      <SettingRow label="Max Context Messages">
        <input
          type="number"
          min="0"
          max="200"
          value={settings.maxContextMessages}
          onChange={(e) => updateSettings({ maxContextMessages: parseInt(e.target.value) || 50 })}
          className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300"
        />
      </SettingRow>
    </div>
  )
}

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-surface-400">{label}</span>
    <div className="flex items-center">{children}</div>
  </div>
)

const SkillsSettings: React.FC = () => {
  const skills = skillRegistry.getAll()
  return (
    <div className="space-y-3">
      <p className="text-xs text-surface-500">Skills enhance the chat with specialized prompts and workflows.</p>
      {skills.map((skill) => (
        <div key={skill.id} className="border border-surface-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{skill.icon}</span>
            <span className="text-sm font-medium text-surface-200">{skill.name}</span>
            <span className="text-xs text-surface-600">v{skill.version}</span>
          </div>
          <p className="text-xs text-surface-500">{skill.description}</p>
        </div>
      ))}
    </div>
  )
}

const MCPSettings: React.FC = () => {
  return (
    <div className="space-y-3">
      <p className="text-xs text-surface-500">
        MCP (Model Context Protocol) allows the LLM to use external tools and resources.
      </p>
      <div className="border border-surface-700 rounded-lg p-3 text-center text-sm text-surface-500">
        <p>MCP server configuration</p>
        <p className="text-xs mt-1">Configure MCP servers in the settings file to enable tool use.</p>
      </div>
    </div>
  )
}
