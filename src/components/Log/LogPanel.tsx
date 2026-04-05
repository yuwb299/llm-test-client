import React, { useState, useMemo } from 'react'
import {
  ScrollText, Trash2, ChevronDown, ChevronRight, Clock, Zap,
  AlertCircle, CheckCircle2, XCircle, Search, Download, Filter,
} from 'lucide-react'
import { useLogStore } from '@/store/logStore'
import { InteractionLog, InteractionLogStatus } from '@/types/log'

const STATUS_CONFIG: Record<InteractionLogStatus, { icon: React.ReactNode; label: string; color: string }> = {
  success: { icon: <CheckCircle2 size={14} />, label: '成功', color: 'text-green-400' },
  error: { icon: <AlertCircle size={14} />, label: '错误', color: 'text-red-400' },
  aborted: { icon: <XCircle size={14} />, label: '中断', color: 'text-yellow-400' },
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function tokenCost(log: InteractionLog): string {
  const u = log.response?.usage
  if (!u) return '-'
  return `${u.promptTokens}/${u.completionTokens}/${u.totalTokens}`
}

const LogDetail: React.FC<{ log: InteractionLog }> = ({ log }) => {
  return (
    <div className="px-4 py-3 bg-surface-900/50 border-t border-surface-700 space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-surface-500 text-xs mb-1">请求参数</div>
          <div className="space-y-0.5 text-xs">
            <div>Temperature: {log.request.temperature ?? '-'}</div>
            <div>Top P: {log.request.topP ?? '-'}</div>
            <div>Max Tokens: {log.request.maxTokens ?? '-'}</div>
            <div>消息数: {log.request.messageCount}</div>
            {log.request.hasSystemPrompt && (
              <div>
                System Prompt: <span className="text-surface-400">{log.request.systemPromptPreview}</span>
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="text-surface-500 text-xs mb-1">响应信息</div>
          <div className="space-y-0.5 text-xs">
            {log.response && (
              <>
                <div>耗时: {formatTime(log.response.durationMs)}</div>
                {log.response.ttfbMs != null && <div>TTFB: {formatTime(log.response.ttfbMs)}</div>}
                <div>Tokens (prompt/completion/total): {tokenCost(log)}</div>
                {log.response.finishReason && <div>Finish Reason: {log.response.finishReason}</div>}
              </>
            )}
            {log.error && <div className="text-red-400">错误: {log.error}</div>}
          </div>
        </div>
      </div>

      <div>
        <div className="text-surface-500 text-xs mb-1">请求消息</div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {log.request.messages.map((m, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className={`font-medium ${
                m.role === 'user' ? 'text-blue-400' :
                m.role === 'assistant' ? 'text-green-400' :
                m.role === 'system' ? 'text-yellow-400' : 'text-surface-400'
              }`}>
                [{m.role}]
              </span>
              <span className="text-surface-300 break-all">{m.contentPreview}</span>
            </div>
          ))}
        </div>
      </div>

      {log.response?.content && (
        <div>
          <div className="text-surface-500 text-xs mb-1">响应内容</div>
          <pre className="text-xs text-surface-300 bg-surface-950 rounded p-2 max-h-60 overflow-y-auto whitespace-pre-wrap break-all">
            {log.response.content}
          </pre>
        </div>
      )}
    </div>
  )
}

export const LogPanel: React.FC = () => {
  const { logs, clearLogs, deleteLog } = useLogStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchText, setSearchText] = useState('')

  const providerOptions = useMemo(() => {
    const set = new Set(logs.map((l) => l.providerName))
    return Array.from(set).sort()
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterProvider !== 'all' && log.providerName !== filterProvider) return false
      if (filterStatus !== 'all' && log.status !== filterStatus) return false
      if (searchText) {
        const lower = searchText.toLowerCase()
        const match =
          log.model.toLowerCase().includes(lower) ||
          log.providerName.toLowerCase().includes(lower) ||
          log.error?.toLowerCase().includes(lower) ||
          log.response?.content.toLowerCase().includes(lower) ||
          log.request.messages.some((m) => m.contentPreview.toLowerCase().includes(lower))
        if (!match) return false
      }
      return true
    })
  }, [logs, filterProvider, filterStatus, searchText])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `llm-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = useMemo(() => {
    const total = filtered.length
    const errors = filtered.filter((l) => l.status === 'error').length
    const avgDuration = total > 0
      ? Math.round(filtered.reduce((s, l) => s + (l.response?.durationMs ?? 0), 0) / total)
      : 0
    const totalTokens = filtered.reduce((s, l) => s + (l.response?.usage?.totalTokens ?? 0), 0)
    return { total, errors, avgDuration, totalTokens }
  }, [filtered])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-700 bg-surface-900 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索日志..."
              className="pl-7 pr-2 py-1 text-sm bg-surface-800 border border-surface-700 rounded-lg text-surface-200 placeholder-surface-500 focus:outline-none focus:border-primary-500 w-48"
            />
          </div>

          <div className="relative">
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="appearance-none pl-2 pr-6 py-1 text-sm bg-surface-800 border border-surface-700 rounded-lg text-surface-200 focus:outline-none focus:border-primary-500"
            >
              <option value="all">全部提供商</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <Filter size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="appearance-none pl-2 pr-6 py-1 text-sm bg-surface-800 border border-surface-700 rounded-lg text-surface-200 focus:outline-none focus:border-primary-500"
            >
              <option value="all">全部状态</option>
              <option value="success">成功</option>
              <option value="error">错误</option>
              <option value="aborted">中断</option>
            </select>
            <Filter size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500">
            {stats.total} 条 | 均耗 {formatTime(stats.avgDuration)} | 总 {stats.totalTokens} tokens
            {stats.errors > 0 && <span className="text-red-400 ml-1">({stats.errors} 错误)</span>}
          </span>

          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
            title="导出日志"
          >
            <Download size={14} />
          </button>

          <button
            onClick={() => {
              if (confirm('确定清除所有交互日志？')) clearLogs()
            }}
            className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-surface-800 transition-colors"
            title="清除所有日志"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-500 gap-2">
            <ScrollText size={40} />
            <span className="text-sm">暂无交互日志</span>
          </div>
        ) : (
          <div>
            {filtered.map((log) => {
              const statusCfg = STATUS_CONFIG[log.status]
              const expanded = expandedId === log.id
              return (
                <div key={log.id} className="border-b border-surface-800">
                  <button
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-900 transition-colors flex items-center gap-3"
                  >
                    <span className="text-surface-500">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    <span className={statusCfg.color}>{statusCfg.icon}</span>
                    <span className="text-xs text-surface-500 w-36 shrink-0">{formatTimestamp(log.timestamp)}</span>
                    <span className="text-xs font-medium text-surface-300 w-24 shrink-0 truncate" title={log.providerName}>{log.providerName}</span>
                    <span className="text-xs text-surface-400 w-32 shrink-0 truncate" title={log.model}>{log.model}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      log.type === 'stream' ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'
                    }`}>
                      {log.type === 'stream' ? '流式' : '非流式'}
                    </span>
                    {log.response && (
                      <>
                        <span className="text-xs text-surface-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(log.response.durationMs)}
                        </span>
                        {log.response.ttfbMs != null && (
                          <span className="text-xs text-surface-500 flex items-center gap-1">
                            <Zap size={10} />
                            TTFB {formatTime(log.response.ttfbMs)}
                          </span>
                        )}
                        {log.response.usage && (
                          <span className="text-xs text-surface-500">
                            {log.response.usage.totalTokens} tokens
                          </span>
                        )}
                      </>
                    )}
                    {log.error && (
                      <span className="text-xs text-red-400 truncate" title={log.error}>{log.error}</span>
                    )}
                    <span className="flex-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteLog(log.id) }}
                      className="p-1 rounded text-surface-600 hover:text-red-400 transition-colors shrink-0"
                      title="删除此条"
                    >
                      <Trash2 size={12} />
                    </button>
                  </button>
                  {expanded && <LogDetail log={log} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
