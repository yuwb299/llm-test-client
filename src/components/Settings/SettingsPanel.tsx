import React, { useState, useCallback } from 'react'
import { X, Save, Eye, EyeOff, Plus, Trash2, Edit2, Check, Wifi, WifiOff, Loader2, Server, Cloud } from 'lucide-react'
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
      <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <h3 className="text-sm font-semibold text-surface-200">设置</h3>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-surface-700">
          {([
            { key: 'providers' as const, label: '模型配置' },
            { key: 'general' as const, label: '通用' },
            { key: 'skills' as const, label: '技能' },
            { key: 'mcp' as const, label: 'MCP' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === key ? 'text-primary-400 border-b-2 border-primary-400' : 'text-surface-500 hover:text-surface-300'
              }`}
            >
              {label}
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

function sortProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return [...providers].sort((a, b) => {
    if (a.isLocal && !b.isLocal) return -1
    if (!a.isLocal && b.isLocal) return 1
    if (a.enabled && !b.enabled) return -1
    if (!a.enabled && b.enabled) return 1
    return 0
  })
}

const ProviderSettings: React.FC<{
  providers: ProviderConfig[]
  onUpdate: (id: string, updates: Partial<ProviderConfig>) => void
  onAdd: (provider: ProviderConfig) => void
  onRemove: (id: string) => void
}> = ({ providers, onUpdate, onAdd, onRemove }) => {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [newProvider, setNewProvider] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const sorted = sortProviders(providers)
  const localProviders = sorted.filter((p) => p.isLocal)
  const remoteProviders = sorted.filter((p) => !p.isLocal)

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const renderProvider = (p: ProviderConfig) => {
    const isCollapsed = collapsed[p.id]
    const isLocal = p.isLocal

    return (
      <div
        key={p.id}
        className={`border rounded-lg overflow-hidden transition-colors ${
          isLocal
            ? 'border-emerald-800/60 bg-emerald-950/20'
            : p.enabled
              ? 'border-surface-700 bg-surface-850'
              : 'border-surface-800 bg-surface-900 opacity-60'
        }`}
      >
        <div
          className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none"
          onClick={() => toggleCollapse(p.id)}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.enabled}
              onChange={(e) => {
                e.stopPropagation()
                onUpdate(p.id, { enabled: e.target.checked })
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded"
            />
            {isLocal ? (
              <Server size={16} className="text-emerald-400" />
            ) : (
              <Cloud size={16} className="text-surface-500" />
            )}
            <span className="text-sm font-medium text-surface-200">{p.name}</span>
            {isLocal && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-800/50">
                本地
              </span>
            )}
            {!isLocal && (
              <span className="text-xs text-surface-600 px-1.5 py-0.5 bg-surface-700 rounded">{p.type}</span>
            )}
            <span className="text-xs text-surface-600">
              {p.models.length} 个模型
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ConnectionTestButton provider={p} />
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(p.id)
              }}
              className="p-1 text-surface-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
            <span className="text-surface-600 ml-1">
              {isCollapsed ? '▸' : '▾'}
            </span>
          </div>
        </div>

        {!isCollapsed && (
          <div className="px-3 pb-3 space-y-3 border-t border-surface-700/50 pt-3">
            {isLocal && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-emerald-950/30 border border-emerald-900/30 text-xs text-emerald-400/80">
                <Server size={12} />
                <span>本地模型无需 API Key，请确保 Ollama 服务已启动且地址可达</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-surface-500 mb-1 block">API 地址</label>
                <input
                  value={p.apiBaseUrl}
                  onChange={(e) => onUpdate(p.id, { apiBaseUrl: e.target.value })}
                  placeholder={isLocal ? 'http://localhost:11434/v1' : 'https://api.example.com/v1'}
                  className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-surface-500 mb-1 block">
                  API Key {isLocal && <span className="text-surface-600">(通常无需设置)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showKey[p.id] ? 'text' : 'password'}
                    value={p.apiKey}
                    onChange={(e) => onUpdate(p.id, { apiKey: e.target.value })}
                    placeholder={isLocal ? 'ollama' : 'sk-...'}
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
                <label className="text-xs text-surface-500">模型列表 ({p.models.length})</label>
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
                  添加模型
                </button>
              </div>
              <div className="space-y-1.5">
                {p.models.map((m, idx) => (
                  <ModelItem
                    key={`model-${p.id}-${idx}`}
                    initialModel={m}
                    isLocal={isLocal}
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
                  <div className="text-xs text-surface-600 text-center py-2">暂未配置模型</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {localProviders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Server size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">本地模型</span>
            <span className="text-xs text-surface-600">({localProviders.length})</span>
          </div>
          <div className="space-y-2">
            {localProviders.map(renderProvider)}
          </div>
        </div>
      )}

      {remoteProviders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Cloud size={14} className="text-surface-500" />
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">云端模型</span>
            <span className="text-xs text-surface-600">({remoteProviders.length})</span>
          </div>
          <div className="space-y-2">
            {remoteProviders.map(renderProvider)}
          </div>
        </div>
      )}

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
          添加自定义 Provider
        </button>
      )}
    </div>
  )
}

const ConnectionTestButton: React.FC<{ provider: ProviderConfig }> = ({ provider }) => {
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const testConnection = useCallback(async () => {
    setStatus('testing')
    try {
      const url = provider.isLocal
        ? `${provider.apiBaseUrl.replace(/\/v1$/, '')}/api/tags`
        : `${provider.apiBaseUrl}/models`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!provider.isLocal && provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal })
      clearTimeout(timeout)

      setStatus(res.ok ? 'ok' : 'fail')
    } catch {
      setStatus('fail')
    }
    setTimeout(() => setStatus('idle'), 3000)
  }, [provider])

  return (
    <button
      onClick={(e) => { e.stopPropagation(); testConnection() }}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors"
      title="测试连接"
    >
      {status === 'idle' && (
        <span className="text-surface-600 hover:text-surface-400">
          <Wifi size={13} />
        </span>
      )}
      {status === 'testing' && (
        <span className="text-yellow-400">
          <Loader2 size={13} className="animate-spin" />
        </span>
      )}
      {status === 'ok' && (
        <span className="text-green-400 flex items-center gap-0.5">
          <Wifi size={13} />
        </span>
      )}
      {status === 'fail' && (
        <span className="text-red-400 flex items-center gap-0.5">
          <WifiOff size={13} />
        </span>
      )}
    </button>
  )
}

const ModelItem: React.FC<{
  initialModel: ModelInfo
  isLocal?: boolean
  onSave: (model: ModelInfo) => void
  onRemove: () => void
}> = ({ initialModel, isLocal, onSave, onRemove }) => {
  const [editing, setEditing] = useState(!initialModel.id)
  const [draft, setDraft] = useState<ModelInfo>({ ...initialModel })
  const [inputPrice, setInputPrice] = useState(initialModel.pricing?.inputPerMillion?.toString() ?? '')
  const [outputPrice, setOutputPrice] = useState(initialModel.pricing?.outputPerMillion?.toString() ?? '')

  if (editing) {
    return (
      <div className="bg-surface-900 border border-surface-700 rounded-lg p-2.5 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-surface-600 block mb-0.5">模型 ID</label>
            <input
              value={draft.id}
              onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
              placeholder="例: gemma4:31b"
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-600 block mb-0.5">显示名称</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="例: Gemma 4 31B"
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-600 block mb-0.5">最大上下文长度</label>
            <input
              type="number"
              value={draft.maxTokens}
              onChange={(e) => setDraft((d) => ({ ...d, maxTokens: parseInt(e.target.value) || 4096 }))}
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-end">
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input type="checkbox" checked={draft.supportsVision} onChange={(e) => setDraft((d) => ({ ...d, supportsVision: e.target.checked }))} />
              Vision
            </label>
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input type="checkbox" checked={draft.supportsStreaming} onChange={(e) => setDraft((d) => ({ ...d, supportsStreaming: e.target.checked }))} />
              Stream
            </label>
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input type="checkbox" checked={draft.supportsToolUse} onChange={(e) => setDraft((d) => ({ ...d, supportsToolUse: e.target.checked }))} />
              Tools
            </label>
            <label className="flex items-center gap-1 text-xs text-surface-400 cursor-pointer">
              <input type="checkbox" checked={draft.supportsJsonMode} onChange={(e) => setDraft((d) => ({ ...d, supportsJsonMode: e.target.checked }))} />
              JSON
            </label>
          </div>
        </div>
        {!isLocal && (
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div>
                <label className="text-xs text-surface-600 block mb-0.5">输入 $/M tokens</label>
                <input
                  type="number" step="0.01" value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  placeholder="0"
                  className="w-24 bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-surface-600 block mb-0.5">输出 $/M tokens</label>
                <input
                  type="number" step="0.01" value={outputPrice}
                  onChange={(e) => setOutputPrice(e.target.value)}
                  placeholder="0"
                  className="w-24 bg-surface-850 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-1">
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
            title="保存"
          >
            <Check size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-surface-500 hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
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
        {isLocal && !initialModel.pricing && (
          <span className="text-xs text-emerald-500 shrink-0">免费</span>
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
          title="编辑"
        >
          <Edit2 size={12} />
        </button>
        <button onClick={onRemove} className="p-1 text-surface-500 hover:text-red-400" title="删除">
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
  const [isLocal, setIsLocal] = useState(false)

  return (
    <div className="border border-surface-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-3 mb-1">
        <label className="flex items-center gap-1.5 text-xs text-surface-400 cursor-pointer">
          <input type="checkbox" checked={isLocal} onChange={(e) => setIsLocal(e.target.checked)} />
          本地模型 (Ollama / LMStudio 等)
        </label>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isLocal ? '例: My Ollama' : 'Provider 名称'}
        className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
      />
      <input
        value={apiBaseUrl}
        onChange={(e) => setApiBaseUrl(e.target.value)}
        placeholder={isLocal ? 'http://localhost:11434/v1' : 'API Base URL'}
        className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
      />
      {!isLocal && (
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          type="password"
          className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
        />
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 px-2 py-1.5 bg-surface-700 rounded text-sm text-surface-300 hover:bg-surface-600">
          取消
        </button>
        <button
          onClick={() => {
            if (!name || !apiBaseUrl) return
            onSave({
              id: generateId(),
              name,
              type: isLocal ? 'ollama' : 'custom',
              apiBaseUrl,
              apiKey: isLocal ? 'ollama' : apiKey,
              models: [],
              enabled: true,
              isLocal,
            })
          }}
          className="flex-1 px-2 py-1.5 bg-primary-600 rounded text-sm text-white hover:bg-primary-500"
        >
          添加
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
      <SettingRow label="主题">
        <select
          value={settings.theme}
          onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}
          className="bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300"
        >
          <option value="dark">深色</option>
          <option value="light">浅色</option>
          <option value="system">跟随系统</option>
        </select>
      </SettingRow>
      <SettingRow label="Enter 发送">
        <input type="checkbox" checked={settings.sendOnEnter} onChange={(e) => updateSettings({ sendOnEnter: e.target.checked })} />
      </SettingRow>
      <SettingRow label="显示 Token 计数">
        <input type="checkbox" checked={settings.showTokenCount} onChange={(e) => updateSettings({ showTokenCount: e.target.checked })} />
      </SettingRow>
      <SettingRow label="显示时间戳">
        <input type="checkbox" checked={settings.showTimestamp} onChange={(e) => updateSettings({ showTimestamp: e.target.checked })} />
      </SettingRow>
      <SettingRow label="流式响应">
        <input type="checkbox" checked={settings.streamEnabled} onChange={(e) => updateSettings({ streamEnabled: e.target.checked })} />
      </SettingRow>
      <SettingRow label="Temperature">
        <input
          type="range" min="0" max="2" step="0.1" value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          className="flex-1"
        />
        <span className="text-sm text-surface-400 ml-2 w-8">{settings.temperature}</span>
      </SettingRow>
      <SettingRow label="最大 Tokens">
        <div className="flex flex-col items-end gap-1">
          <input
            type="number" value={settings.maxTokens}
            onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
            className="w-24 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300"
            min="1"
            max="32768"
          />
          <span className="text-xs text-surface-500">本地模型可设置更大值（如8192-32768）</span>
        </div>
      </SettingRow>
      <SettingRow label="字体大小">
        <input
          type="number" min="12" max="20" value={settings.fontSize}
          onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) || 14 })}
          className="w-20 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-surface-300"
        />
      </SettingRow>
      <SettingRow label="最大上下文消息数">
        <input
          type="number" min="0" max="200" value={settings.maxContextMessages}
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
      <p className="text-xs text-surface-500">技能通过专业提示词和工作流增强对话功能。</p>
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
        MCP (Model Context Protocol) 允许 LLM 使用外部工具和资源。
      </p>
      <div className="border border-surface-700 rounded-lg p-3 text-center text-sm text-surface-500">
        <p>MCP 服务器配置</p>
        <p className="text-xs mt-1">在配置文件中配置 MCP 服务器以启用工具调用。</p>
      </div>
    </div>
  )
}
