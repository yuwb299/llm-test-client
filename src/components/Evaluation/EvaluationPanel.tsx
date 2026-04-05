import React, { useState, useCallback, useRef } from 'react'
import {
  FlaskConical, Play, Plus, Trash2, ChevronDown, ChevronRight,
  Clock, Gauge, Star, FileText, Download, AlertCircle, CheckCircle2,
  XCircle, Loader2, StickyNote, RefreshCw, RotateCcw, Eye,
} from 'lucide-react'
import { useEvaluationStore, QUESTION_TEMPLATES } from '@/store/evaluationStore'
import { useProviderStore } from '@/store/providerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { providerRegistry } from '@/providers'
import { ChatMessage } from '@/types/message'
import {
  EvaluationRecord, EvaluationMetrics, TestQuestion,
  QuestionCategory, CATEGORY_LABELS, DIFFICULTY_LABELS,
  VERDICT_LABELS, VERDICT_COLORS,
} from '@/types/evaluation'
import { generateId } from '@/utils/helpers'
import { MarkdownRenderer } from '@/components/Markdown/MarkdownRenderer'

type EvalTab = 'questions' | 'results' | 'notes'

export const EvaluationPanel: React.FC = () => {
  const {
    sessions, activeSessionId, isRunning, currentProgress,
    getActiveSession, createSession, deleteSession, setActiveSession,
    addRecord, updateRecordNotes, deleteRecord, setRunning, setProgress,
  } = useEvaluationStore()

  const [tab, setTab] = useState<EvalTab>('questions')
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | 'all'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [newSessionName, setNewSessionName] = useState('')
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [localProviderId, setLocalProviderId] = useState('')
  const [localModelId, setLocalModelId] = useState('')
  const [judgeProviderId, setJudgeProviderId] = useState('')
  const [judgeModelId, setJudgeModelId] = useState('')
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customCategory, setCustomCategory] = useState<QuestionCategory>('custom')
  const [customDifficulty, setCustomDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [localQuestions, setLocalQuestions] = useState<TestQuestion[]>(
    QUESTION_TEMPLATES.map((q, i) => ({ ...q, id: `builtin-${i}` }))
  )

  const providers = useProviderStore((s) => s.providers)
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const activeModelId = useProviderStore((s) => s.activeModelId)
  const settings = useSettingsStore((s) => s.settings)
  const runningRef = useRef(false)

  const activeSession = getActiveSession()

  const filteredQuestions = localQuestions.filter((q) => {
    if (categoryFilter !== 'all' && q.category !== categoryFilter) return false
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false
    return true
  })

  const toggleQuestion = (id: string) => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedQuestions(new Set(filteredQuestions.map((q) => q.id)))
  }

  const deselectAll = () => setSelectedQuestions(new Set())

  const handleAddCustomQuestion = () => {
    if (!customPrompt.trim()) return
    const q: TestQuestion = {
      id: `custom-${Date.now()}`,
      category: customCategory,
      prompt: customPrompt.trim(),
      expectedAspects: [],
      difficulty: customDifficulty,
    }
    setLocalQuestions((prev) => [...prev, q])
    setCustomPrompt('')
  }

  const handleCreateSession = () => {
    const name = newSessionName.trim() || `评估 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    createSession(name)
    setNewSessionName('')
    setShowSessionForm(false)
  }

  const runEvaluation = useCallback(async () => {
    if (!activeSessionId || selectedQuestions.size === 0) return

    const localProvId = localProviderId || activeProviderId
    const localModId = localModelId || activeModelId
    const judgeProv = judgeProviderId || activeProviderId
    const judgeMod = judgeModelId || activeModelId
    const localProvider = providerRegistry.get(localProvId)
    const judgeProviderInst = providerRegistry.get(judgeProv)

    if (!localProvider || !judgeProviderInst) {
      alert('请确认本地模型和评判模型均已正确配置')
      return
    }

    setRunning(true)
    runningRef.current = true
    const questions = localQuestions.filter((q) => selectedQuestions.has(q.id))
    setProgress({ completed: 0, total: questions.length })

    for (let i = 0; i < questions.length; i++) {
      if (!runningRef.current) break

      const question = questions[i]

      try {
        const localStart = performance.now()
        let ttfb = 0
        let fullResponse = ''
        let tokenCount = 0
        let firstChunk = true

        const userMsg: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: question.prompt,
          timestamp: Date.now(),
        }

        const stream = localProvider.stream({
          model: localModId,
          messages: [userMsg],
          temperature: settings.temperature,
          topP: settings.topP,
          maxTokens: settings.maxTokens,
          stream: true,
        })

        for await (const chunk of stream) {
          if (firstChunk && chunk.content) {
            ttfb = performance.now() - localStart
            firstChunk = false
          }
          if (chunk.content) {
            fullResponse += chunk.content
          }
          if (chunk.usage?.completionTokens) {
            tokenCount = chunk.usage.completionTokens
          }
        }

        const totalDuration = performance.now() - localStart
        if (tokenCount === 0) {
          tokenCount = Math.ceil(fullResponse.length / 3.5)
        }
        const tokensPerSecond = totalDuration > 0 ? (tokenCount / (totalDuration / 1000)) : 0

        const judgeSystemPrompt = `你是一个专业的AI模型评估专家。你需要评估以下AI回复的质量。

评估题目: ${question.prompt}
题目类别: ${CATEGORY_LABELS[question.category]}
期望考察点: ${question.expectedAspects.join('、') || '综合评估'}

AI的回复:
${fullResponse}

请严格按以下JSON格式输出评估结果（不要输出其他内容）:
{
  "relevance": 1-10分,
  "accuracy": 1-10分,
  "completeness": 1-10分,
  "clarity": 1-10分,
  "overall": 1-10分,
  "verdict": "excellent/good/average/poor/fail",
  "feedback": "详细的评估反馈，指出优点和不足"
}`

        const judgeMsg: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: judgeSystemPrompt,
          timestamp: Date.now(),
        }

        const judgeResponse = await judgeProviderInst.complete({
          model: judgeMod,
          messages: [judgeMsg],
          temperature: 0.3,
          maxTokens: 2000,
          stream: false,
        })

        let metrics: EvaluationMetrics
        let judgeFeedback = ''
        try {
          const jsonStr = judgeResponse.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
          const parsed = JSON.parse(jsonStr)
          metrics = {
            speed: {
              ttfb: Math.round(ttfb),
              tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
              totalDurationMs: Math.round(totalDuration),
              outputTokens: tokenCount,
            },
            quality: {
              relevance: Math.min(10, Math.max(1, parsed.relevance || 0)),
              accuracy: Math.min(10, Math.max(1, parsed.accuracy || 0)),
              completeness: Math.min(10, Math.max(1, parsed.completeness || 0)),
              clarity: Math.min(10, Math.max(1, parsed.clarity || 0)),
              overall: Math.min(10, Math.max(1, parsed.overall || 0)),
            },
            verdict: parsed.verdict || 'average',
          }
          judgeFeedback = parsed.feedback || ''
        } catch {
          const overallScore = tokensPerSecond > 10 ? 7 : tokensPerSecond > 5 ? 5 : 3
          metrics = {
            speed: {
              ttfb: Math.round(ttfb),
              tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
              totalDurationMs: Math.round(totalDuration),
              outputTokens: tokenCount,
            },
            quality: { relevance: overallScore, accuracy: overallScore, completeness: overallScore, clarity: overallScore, overall: overallScore },
            verdict: overallScore >= 7 ? 'good' : overallScore >= 5 ? 'average' : 'poor',
          }
          judgeFeedback = judgeResponse.content.slice(0, 500)
        }

        const record: EvaluationRecord = {
          id: generateId(),
          questionId: question.id,
          question,
          localModel: localModId,
          localProvider: localProvId,
          response: fullResponse,
          metrics,
          judgeModel: judgeMod,
          judgeProvider: judgeProv,
          judgeFeedback,
          notes: '',
          createdAt: Date.now(),
        }

        addRecord(activeSessionId, record)
      } catch (err) {
        const record: EvaluationRecord = {
          id: generateId(),
          questionId: question.id,
          question,
          localModel: localModId,
          localProvider: localProvId,
          response: `评估失败: ${err instanceof Error ? err.message : 'Unknown error'}`,
          metrics: {
            speed: { ttfb: 0, tokensPerSecond: 0, totalDurationMs: 0, outputTokens: 0 },
            quality: { relevance: 0, accuracy: 0, completeness: 0, clarity: 0, overall: 0 },
            verdict: 'fail',
          },
          judgeModel: judgeMod,
          judgeProvider: judgeProv,
          judgeFeedback: '评估过程出错',
          notes: '',
          createdAt: Date.now(),
        }
        addRecord(activeSessionId, record)
      }

      setProgress({ completed: i + 1, total: questions.length })
    }

    setRunning(false)
    runningRef.current = false
    setProgress(null)
  }, [activeSessionId, selectedQuestions, localQuestions, activeProviderId, activeModelId, localProviderId, localModelId, judgeProviderId, judgeModelId, settings])

  const stopEvaluation = () => {
    runningRef.current = false
    setRunning(false)
    setProgress(null)
  }

  const exportResults = () => {
    if (!activeSession) return
    const data = JSON.stringify(activeSession, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evaluation-${activeSession.name}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const localProviders = providers.filter((p) => p.enabled)
  const enabledProviders = providers.filter((p) => p.enabled && p.apiKey)

  return (
    <div className="flex h-full">
      <div className="w-56 h-full bg-surface-900 border-r border-surface-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-surface-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-surface-200">
            <FlaskConical size={16} />
            <span>评估系统</span>
          </div>
        </div>

        <div className="p-2">
          {showSessionForm ? (
            <div className="space-y-2 p-2 bg-surface-800 rounded-lg">
              <input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="评估名称..."
                className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              />
              <div className="flex gap-1">
                <button onClick={handleCreateSession} className="flex-1 px-2 py-1 bg-primary-600 rounded text-xs text-white hover:bg-primary-500">确定</button>
                <button onClick={() => setShowSessionForm(false)} className="flex-1 px-2 py-1 bg-surface-700 rounded text-xs text-surface-300 hover:bg-surface-600">取消</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSessionForm(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} />
              新建评估
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-colors mb-0.5 ${
                activeSessionId === session.id
                  ? 'bg-surface-800 text-surface-100'
                  : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-300'
              }`}
              onClick={() => setActiveSession(session.id)}
            >
              <FlaskConical size={13} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{session.name}</div>
                <div className="text-xs text-surface-600">{session.records.length} 条记录</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-6 text-xs text-surface-600">暂无评估会话</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activeSession ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-700 bg-surface-900">
              {(['questions', 'results', 'notes'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    tab === t ? 'bg-surface-700 text-primary-300' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800'
                  }`}
                >
                  {t === 'questions' ? '题库' : t === 'results' ? '结果' : '笔记'}
                </button>
              ))}
              <div className="flex-1" />
              {activeSession.records.length > 0 && (
                <button
                  onClick={exportResults}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-surface-400 hover:text-surface-200 bg-surface-800 rounded-lg transition-colors"
                >
                  <Download size={13} />
                  导出
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'questions' && (
                <QuestionsTab
                  questions={filteredQuestions}
                  localQuestions={localQuestions}
                  selectedQuestions={selectedQuestions}
                  categoryFilter={categoryFilter}
                  difficultyFilter={difficultyFilter}
                  customPrompt={customPrompt}
                  customCategory={customCategory}
                  customDifficulty={customDifficulty}
                  isRunning={isRunning}
                  currentProgress={currentProgress}
                  enabledProviders={enabledProviders}
                  localProviders={localProviders}
                  localProviderId={localProviderId}
                  localModelId={localModelId}
                  judgeProviderId={judgeProviderId}
                  judgeModelId={judgeModelId}
                  activeProviderId={activeProviderId}
                  activeModelId={activeModelId}
                  onToggleQuestion={toggleQuestion}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                  onCategoryFilter={setCategoryFilter}
                  onDifficultyFilter={setDifficultyFilter}
                  onCustomPrompt={setCustomPrompt}
                  onCustomCategory={setCustomCategory}
                  onCustomDifficulty={setCustomDifficulty}
                  onAddCustomQuestion={handleAddCustomQuestion}
                  onRun={runEvaluation}
                  onStop={stopEvaluation}
                  onLocalProvider={setLocalProviderId}
                  onLocalModel={setLocalModelId}
                  onJudgeProvider={setJudgeProviderId}
                  onJudgeModel={setJudgeModelId}
                />
              )}
              {tab === 'results' && (
                <ResultsTab
                  records={activeSession.records}
                  expandedRecord={expandedRecord}
                  onToggleRecord={setExpandedRecord}
                  onUpdateNotes={updateRecordNotes}
                  onDeleteRecord={(recordId) => deleteRecord(activeSession.id, recordId)}
                  sessionId={activeSession.id}
                />
              )}
              {tab === 'notes' && (
                <NotesTab session={activeSession} onUpdateNotes={updateRecordNotes} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <FlaskConical size={48} className="mx-auto text-surface-700" />
              <h3 className="text-lg font-semibold text-surface-300">联网大模型在线评估系统</h3>
              <p className="text-sm text-surface-500 max-w-md">
                使用强大的在线模型（GPT-4o / Claude / Gemini）作为评判，<br />
                自动评估本地模型的回答质量和生成速度
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-surface-600">
                {['自动出题', '质量评估', '速度测试', '笔记记录', '结果导出'].map((f) => (
                  <span key={f} className="px-2 py-1 bg-surface-800 rounded">{f}</span>
                ))}
              </div>
              <p className="text-xs text-surface-600">请先新建一个评估会话</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface QuestionsTabProps {
  questions: TestQuestion[]
  localQuestions: TestQuestion[]
  selectedQuestions: Set<string>
  categoryFilter: QuestionCategory | 'all'
  difficultyFilter: string
  customPrompt: string
  customCategory: QuestionCategory
  customDifficulty: 'easy' | 'medium' | 'hard'
  isRunning: boolean
  currentProgress: { completed: number; total: number } | null
  enabledProviders: { id: string; name: string; models: { id: string; name: string }[]; apiKey: string }[]
  localProviders: { id: string; name: string; models: { id: string; name: string }[] }[]
  localProviderId: string
  localModelId: string
  judgeProviderId: string
  judgeModelId: string
  activeProviderId: string
  activeModelId: string
  onToggleQuestion: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onCategoryFilter: (f: QuestionCategory | 'all') => void
  onDifficultyFilter: (f: string) => void
  onCustomPrompt: (v: string) => void
  onCustomCategory: (v: QuestionCategory) => void
  onCustomDifficulty: (v: 'easy' | 'medium' | 'hard') => void
  onAddCustomQuestion: () => void
  onRun: () => void
  onStop: () => void
  onJudgeProvider: (v: string) => void
  onJudgeModel: (v: string) => void
  onLocalProvider: (v: string) => void
  onLocalModel: (v: string) => void
}

const QuestionsTab: React.FC<QuestionsTabProps> = ({
  questions, localQuestions, selectedQuestions, categoryFilter, difficultyFilter,
  customPrompt, customCategory, customDifficulty,
  isRunning, currentProgress, enabledProviders, localProviders,
  localProviderId, localModelId, judgeProviderId, judgeModelId, activeProviderId, activeModelId,
  onToggleQuestion, onSelectAll, onDeselectAll,
  onCategoryFilter, onDifficultyFilter,
  onCustomPrompt, onCustomCategory, onCustomDifficulty,
  onAddCustomQuestion, onRun, onStop, onLocalProvider, onLocalModel, onJudgeProvider, onJudgeModel,
}) => {
  const allCategories: QuestionCategory[] = ['reasoning', 'coding', 'math', 'writing', 'knowledge', 'creative', 'instruction_following', 'multilingual', 'safety', 'custom']
  const localProv = localProviders.find((p) => p.id === (localProviderId || activeProviderId))
  const judgeProv = enabledProviders.find((p) => p.id === (judgeProviderId || activeProviderId))

  return (
    <div className="p-4 space-y-4">
      <div className="bg-surface-900 border border-surface-700 rounded-lg p-3 space-y-3">
        <div className="text-sm font-medium text-surface-200">评测配置</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-surface-500 mb-1 block">被测模型（本地）</label>
            <div className="flex gap-2">
              <select
                value={localProviderId}
                onChange={(e) => {
                  onLocalProvider(e.target.value)
                  const p = localProviders.find((pr) => pr.id === e.target.value)
                  if (p?.models[0]) onLocalModel(p.models[0].id)
                }}
                className="flex-1 bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
              >
                {localProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {localProv && (
                <select
                  value={localModelId}
                  onChange={(e) => onLocalModel(e.target.value)}
                  className="flex-1 bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
                >
                  {localProv.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-surface-500 mb-1 block">评判模型（在线大模型）</label>
            <div className="flex gap-2">
              <select
                value={judgeProviderId}
                onChange={(e) => {
                  onJudgeProvider(e.target.value)
                  const p = enabledProviders.find((pr) => pr.id === e.target.value)
                  if (p?.models[0]) onJudgeModel(p.models[0].id)
                }}
                className="flex-1 bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
              >
                {enabledProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {judgeProv && (
                <select
                  value={judgeModelId}
                  onChange={(e) => onJudgeModel(e.target.value)}
                  className="flex-1 bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
                >
                  {judgeProv.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilter(e.target.value as QuestionCategory | 'all')}
          className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none"
        >
          <option value="all">全部类别</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => onDifficultyFilter(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none"
        >
          <option value="all">全部难度</option>
          <option value="easy">简单</option>
          <option value="medium">中等</option>
          <option value="hard">困难</option>
        </select>
        <div className="flex-1" />
        <span className="text-xs text-surface-500">已选 {selectedQuestions.size}/{localQuestions.length} 题</span>
        <button onClick={onSelectAll} className="text-xs text-primary-400 hover:text-primary-300">全选</button>
        <button onClick={onDeselectAll} className="text-xs text-surface-500 hover:text-surface-300">清空</button>
      </div>

      <div className="space-y-1.5">
        {questions.map((q) => (
          <div
            key={q.id}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              selectedQuestions.has(q.id)
                ? 'border-primary-500/50 bg-primary-500/5'
                : 'border-surface-700 hover:border-surface-600'
            }`}
            onClick={() => onToggleQuestion(q.id)}
          >
            <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              selectedQuestions.has(q.id) ? 'bg-primary-600 border-primary-600' : 'border-surface-600'
            }`}>
              {selectedQuestions.has(q.id) && <CheckCircle2 size={12} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-surface-200 leading-relaxed">{q.prompt}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-1.5 py-0.5 bg-surface-800 rounded text-surface-400">
                  {CATEGORY_LABELS[q.category]}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  q.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' :
                  q.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {DIFFICULTY_LABELS[q.difficulty]}
                </span>
                {q.expectedAspects.length > 0 && (
                  <span className="text-xs text-surface-600">考察: {q.expectedAspects.slice(0, 2).join('、')}{q.expectedAspects.length > 2 ? '...' : ''}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-900 border border-surface-700 rounded-lg p-3 space-y-2">
        <div className="text-sm font-medium text-surface-200">添加自定义题目</div>
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPrompt(e.target.value)}
          placeholder="输入自定义测试题..."
          className="w-full bg-surface-850 border border-surface-700 rounded px-2.5 py-2 text-sm text-surface-300 placeholder-surface-600 focus:outline-none focus:border-primary-500 resize-none"
          rows={2}
        />
        <div className="flex items-center gap-2">
          <select
            value={customCategory}
            onChange={(e) => onCustomCategory(e.target.value as QuestionCategory)}
            className="bg-surface-850 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:outline-none"
          >
            {allCategories.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <select
            value={customDifficulty}
            onChange={(e) => onCustomDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
            className="bg-surface-850 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:outline-none"
          >
            <option value="easy">简单</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={onAddCustomQuestion}
            disabled={!customPrompt.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={12} />
            添加
          </button>
        </div>
      </div>

      <div className="sticky bottom-0 bg-surface-950 border-t border-surface-700 px-4 py-3 flex items-center gap-3">
        {isRunning ? (
          <>
            <Loader2 size={18} className="text-primary-400 animate-spin" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-300">评估进行中...</span>
                <span className="text-surface-400">{currentProgress?.completed}/{currentProgress?.total}</span>
              </div>
              <div className="mt-1 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${currentProgress ? (currentProgress.completed / currentProgress.total * 100) : 0}%` }}
                />
              </div>
            </div>
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
            >
              <XCircle size={14} />
              停止
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-surface-500">
              将使用在线模型评估 {selectedQuestions.size} 道题目的回答
            </span>
            <div className="flex-1" />
            <button
              onClick={onRun}
              disabled={selectedQuestions.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={14} />
              开始评测
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface ResultsTabProps {
  records: EvaluationRecord[]
  expandedRecord: string | null
  onToggleRecord: (id: string | null) => void
  onUpdateNotes: (sessionId: string, recordId: string, notes: string) => void
  onDeleteRecord: (recordId: string) => void
  sessionId: string
}

const ResultsTab: React.FC<ResultsTabProps> = ({
  records, expandedRecord, onToggleRecord, onUpdateNotes, onDeleteRecord, sessionId,
}) => {
  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <AlertCircle size={36} className="mx-auto text-surface-700" />
          <p className="text-sm text-surface-500">暂无评估记录，请先在题库中选择题目开始评测</p>
        </div>
      </div>
    )
  }

  const avgSpeed = records.reduce((sum, r) => sum + r.metrics.speed.tokensPerSecond, 0) / records.length
  const avgQuality = records.reduce((sum, r) => sum + r.metrics.quality.overall, 0) / records.length
  const avgTtfb = records.reduce((sum, r) => sum + r.metrics.speed.ttfb, 0) / records.length

  const verdictCounts = records.reduce((acc, r) => {
    acc[r.metrics.verdict] = (acc[r.metrics.verdict] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<Gauge size={16} />} label="平均速度" value={`${avgSpeed.toFixed(1)} t/s`} color="text-blue-400" />
        <StatCard icon={<Clock size={16} />} label="平均首字" value={`${avgTtfb.toFixed(0)} ms`} color="text-cyan-400" />
        <StatCard icon={<Star size={16} />} label="平均质量" value={`${avgQuality.toFixed(1)} / 10`} color="text-yellow-400" />
        <StatCard icon={<FileText size={16} />} label="总记录" value={`${records.length} 条`} color="text-surface-300" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-500">分布:</span>
        {Object.entries(verdictCounts).map(([verdict, count]) => (
          <span key={verdict} className={`text-xs px-2 py-0.5 rounded bg-surface-800 ${VERDICT_COLORS[verdict] || 'text-surface-400'}`}>
            {VERDICT_LABELS[verdict] || verdict} {count}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {records.map((record) => {
          const expanded = expandedRecord === record.id
          return (
            <div key={record.id} className="border border-surface-700 rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-800/50 transition-colors"
                onClick={() => onToggleRecord(expanded ? null : record.id)}
              >
                {expanded ? <ChevronDown size={14} className="text-surface-500" /> : <ChevronRight size={14} className="text-surface-500" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-surface-200 truncate">{record.question.prompt}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-surface-600">{CATEGORY_LABELS[record.question.category]}</span>
                    <span className="text-xs text-surface-700">|</span>
                    <span className="text-xs text-surface-600">{record.localModel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-surface-500">{record.metrics.speed.tokensPerSecond.toFixed(1)} t/s</div>
                    <div className="text-xs text-surface-600">{record.metrics.speed.totalDurationMs}ms</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{record.metrics.quality.overall}/10</div>
                  </div>
                  <span className={`text-xs font-medium ${VERDICT_COLORS[record.metrics.verdict] || ''}`}>
                    {VERDICT_LABELS[record.metrics.verdict] || record.metrics.verdict}
                  </span>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-surface-700 p-4 space-y-4 bg-surface-900/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-medium text-surface-400 mb-2">速度指标</div>
                      <div className="space-y-1.5">
                        <MetricBar label="首字延迟" value={record.metrics.speed.ttfb} max={10000} unit="ms" />
                        <MetricBar label="生成速度" value={record.metrics.speed.tokensPerSecond} max={100} unit="t/s" />
                        <MetricBar label="总耗时" value={record.metrics.speed.totalDurationMs} max={60000} unit="ms" />
                        <div className="text-xs text-surface-500">输出 tokens: {record.metrics.speed.outputTokens}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-surface-400 mb-2">质量评分</div>
                      <div className="space-y-1.5">
                        <ScoreBar label="相关性" value={record.metrics.quality.relevance} />
                        <ScoreBar label="准确性" value={record.metrics.quality.accuracy} />
                        <ScoreBar label="完整性" value={record.metrics.quality.completeness} />
                        <ScoreBar label="清晰度" value={record.metrics.quality.clarity} />
                        <ScoreBar label="总评" value={record.metrics.quality.overall} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-surface-400 mb-1.5">模型回答</div>
                    <div className="bg-surface-850 border border-surface-700 rounded-lg p-3 max-h-60 overflow-y-auto">
                      <MarkdownRenderer content={record.response} />
                    </div>
                  </div>

                  {record.judgeFeedback && (
                    <div>
                      <div className="text-xs font-medium text-surface-400 mb-1.5">评判反馈（{record.judgeModel}）</div>
                      <div className="bg-surface-850 border border-surface-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <MarkdownRenderer content={record.judgeFeedback} />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-surface-400 mb-1.5">笔记</div>
                    <textarea
                      value={record.notes}
                      onChange={(e) => onUpdateNotes(sessionId, record.id, e.target.value)}
                      placeholder="添加你的观察笔记..."
                      className="w-full bg-surface-850 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-300 placeholder-surface-600 focus:outline-none focus:border-primary-500 resize-none"
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteRecord(record.id) }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 size={12} />
                      删除记录
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface NotesTabProps {
  session: { id: string; records: EvaluationRecord[]; name: string }
  onUpdateNotes: (sessionId: string, recordId: string, notes: string) => void
}

const NotesTab: React.FC<NotesTabProps> = ({ session, onUpdateNotes }) => {
  const [globalNotes, setGlobalNotes] = useState('')

  return (
    <div className="p-4 space-y-4">
      <div className="bg-surface-900 border border-surface-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-200">
          <StickyNote size={16} />
          <span>评估总笔记 - {session.name}</span>
        </div>
        <textarea
          value={globalNotes}
          onChange={(e) => setGlobalNotes(e.target.value)}
          placeholder="在这里记录整体评估观察、结论和建议..."
          className="w-full bg-surface-850 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-surface-300 placeholder-surface-600 focus:outline-none focus:border-primary-500 resize-none"
          rows={8}
        />
      </div>

      {session.records.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-surface-300">各题笔记</div>
          {session.records.map((record) => (
            <div key={record.id} className="bg-surface-900 border border-surface-700 rounded-lg p-3">
              <div className="text-xs text-surface-400 mb-1.5 truncate">{record.question.prompt}</div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium ${VERDICT_COLORS[record.metrics.verdict]}`}>
                  {VERDICT_LABELS[record.metrics.verdict]}
                </span>
                <span className="text-xs text-surface-600">{record.metrics.quality.overall}/10</span>
                <span className="text-xs text-surface-600">{record.metrics.speed.tokensPerSecond.toFixed(1)} t/s</span>
              </div>
              <textarea
                value={record.notes}
                onChange={(e) => onUpdateNotes(session.id, record.id, e.target.value)}
                placeholder="添加笔记..."
                className="w-full bg-surface-850 border border-surface-700 rounded px-2.5 py-2 text-sm text-surface-300 placeholder-surface-600 focus:outline-none focus:border-primary-500 resize-none"
                rows={2}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-surface-900 border border-surface-700 rounded-lg p-3">
    <div className="flex items-center gap-1.5 text-surface-500 mb-1">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <div className={`text-lg font-semibold ${color}`}>{value}</div>
  </div>
)

const ScoreBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-surface-500 w-12 shrink-0">{label}</span>
    <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          value >= 8 ? 'bg-green-500' : value >= 6 ? 'bg-blue-500' : value >= 4 ? 'bg-yellow-500' : 'bg-red-500'
        }`}
        style={{ width: `${value * 10}%` }}
      />
    </div>
    <span className="text-xs text-surface-400 w-6 text-right">{value}</span>
  </div>
)

const MetricBar: React.FC<{ label: string; value: number; max: number; unit: string }> = ({ label, value, max, unit }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-surface-500 w-16 shrink-0">{label}</span>
    <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary-500 rounded-full"
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
    <span className="text-xs text-surface-400 w-20 text-right">{value.toFixed(0)} {unit}</span>
  </div>
)
