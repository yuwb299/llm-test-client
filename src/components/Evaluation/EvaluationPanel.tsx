import React, { useState, useCallback, useRef } from 'react'
import {
  FlaskConical, Play, Plus, Trash2, ChevronDown, ChevronRight,
  Clock, Gauge, Star, FileText, Download, AlertCircle, CheckCircle2,
  XCircle, Loader2, StickyNote, RefreshCw, RotateCcw, Eye,
  Upload, Wand2, BarChart3, Trophy, Zap, Target, TrendingUp,
} from 'lucide-react'
import { useEvaluationStore } from '@/store/evaluationStore'
import { useProviderStore } from '@/store/providerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { providerRegistry } from '@/providers'
import { ChatMessage } from '@/types/message'
import {
  EvaluationRecord, EvaluationMetrics, TestQuestion,
  QuestionCategory, DifficultyLevel, QuestionBankFile,
  CATEGORY_LABELS, DIFFICULTY_LABELS, DIFFICULTY_COLORS,
  VERDICT_LABELS, VERDICT_COLORS, ALL_CATEGORIES,
  EvaluationSummary, CategoryScore, DifficultyScore,
  getGrade, computeMaxPoints,
} from '@/types/evaluation'
import { generateId } from '@/utils/helpers'
import { MarkdownRenderer } from '@/components/Markdown/MarkdownRenderer'

type EvalTab = 'questions' | 'results' | 'summary' | 'notes'

const BATCH_SIZE_OPTIONS = [3, 5, 8, 10] as const
const DIFFICULTY_LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5]

export const EvaluationPanel: React.FC = () => {
  const {
    sessions, activeSessionId, isRunning, currentProgress, phase,
    getActiveSession, createSession, deleteSession, setActiveSession,
    addRecord, updateRecordNotes, deleteRecord, clearRecords, updateSessionSummary,
    setRunning, setProgress, setPhase,
  } = useEvaluationStore()

  const [tab, setTab] = useState<EvalTab>('questions')
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | 'all'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel | 'all'>('all')
  const [newSessionName, setNewSessionName] = useState('')
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [localProviderId, setLocalProviderId] = useState('')
  const [localModelId, setLocalModelId] = useState('')
  const [judgeProviderId, setJudgeProviderId] = useState('')
  const [judgeModelId, setJudgeModelId] = useState('')
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

  const [localQuestions, setLocalQuestions] = useState<TestQuestion[]>([])
  const [customPrompt, setCustomPrompt] = useState('')
  const [customCategory, setCustomCategory] = useState<QuestionCategory>('reasoning')
  const [customDifficulty, setCustomDifficulty] = useState<DifficultyLevel>(3)

  const [genCategories, setGenCategories] = useState<Set<QuestionCategory>>(new Set(ALL_CATEGORIES))
  const [genDifficultyMin, setGenDifficultyMin] = useState<DifficultyLevel>(1)
  const [genDifficultyMax, setGenDifficultyMax] = useState<DifficultyLevel>(5)
  const [genTotalCount, setGenTotalCount] = useState(10)
  const [genBatchSize, setGenBatchSize] = useState(5)

  const [evalBatchSize, setEvalBatchSize] = useState(5)

  const providers = useProviderStore((s) => s.providers)
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const activeModelId = useProviderStore((s) => s.activeModelId)
  const settings = useSettingsStore((s) => s.settings)
  const runningRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeSession = getActiveSession()

  const enabledProviders = providers.filter((p) => p.enabled && p.apiKey)
  const localProviders = providers.filter((p) => p.enabled)

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

  const selectAll = () => setSelectedQuestions(new Set(filteredQuestions.map((q) => q.id)))
  const deselectAll = () => setSelectedQuestions(new Set())

  const toggleGenCategory = (c: QuestionCategory) => {
    setGenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) {
        if (next.size > 1) next.delete(c)
      } else {
        next.add(c)
      }
      return next
    })
  }

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

  const buildQuestionGenPrompt = (count: number, cats: QuestionCategory[], dMin: DifficultyLevel, dMax: DifficultyLevel): string => {
    const catNames = cats.map((c) => `${CATEGORY_LABELS[c]}(${c})`).join('、')
    const diffRange = dMin === dMax ? DIFFICULTY_LABELS[dMin] : `${DIFFICULTY_LABELS[dMin]}~${DIFFICULTY_LABELS[dMax]}`
    return `你是一个专业的AI模型测试题目设计专家。请生成 ${count} 道测试题，用于评估AI大模型的能力。

要求：
- 题目类别范围：${catNames}
- 难度范围：${diffRange}（1=入门, 2=基础, 3=进阶, 4=困难, 5=专家）
- 尽量均匀分配各类别和各难度
- 每道题要有明确的考察点(expectedAspects，2-4个)
- 题目内容要多样化，避免重复模式

严格按以下JSON格式输出（不要输出其他任何内容）:
[
  {
    "category": "类别英文名",
    "prompt": "题目内容",
    "expectedAspects": ["考察点1", "考察点2"],
    "difficulty": 难度数字1-5
  }
]`
  }

  const parseQuestionsFromResponse = (content: string, prefix: string): TestQuestion[] => {
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) throw new Error('not array')
    return parsed.map((item: any, i: number) => ({
      id: `${prefix}-${Date.now()}-${i}`,
      category: ALL_CATEGORIES.includes(item.category) ? item.category : 'reasoning',
      prompt: String(item.prompt || ''),
      expectedAspects: Array.isArray(item.expectedAspects) ? item.expectedAspects.map(String) : [],
      difficulty: (DIFFICULTY_LEVELS.includes(item.difficulty) ? item.difficulty : 3) as DifficultyLevel,
    }))
  }

  const generateQuestions = useCallback(async () => {
    const provId = judgeProviderId || activeProviderId
    const modId = judgeModelId || activeModelId
    const provider = providerRegistry.get(provId)
    if (!provider) {
      alert('请先配置用于生成题目的在线模型')
      return
    }

    setRunning(true)
    setPhase('generating')
    runningRef.current = true

    const cats = Array.from(genCategories)
    const totalRemaining = genTotalCount - localQuestions.length
    if (totalRemaining <= 0) {
      setRunning(false)
      setPhase('idle')
      return
    }
    const totalCount = Math.min(genTotalCount, totalRemaining > 0 ? genTotalCount : genTotalCount)

    let generated: TestQuestion[] = []
    let remaining = totalCount
    let batchIndex = 0

    while (remaining > 0 && runningRef.current) {
      const batchCount = Math.min(remaining, genBatchSize)
      setProgress({ completed: generated.length, total: totalCount })

      try {
        const prompt = buildQuestionGenPrompt(batchCount, cats, genDifficultyMin, genDifficultyMax)
        const msg: ChatMessage = { id: generateId(), role: 'user', content: prompt, timestamp: Date.now() }
        const response = await provider.complete({
          model: modId,
          messages: [msg],
          temperature: 0.8,
          maxTokens: 4000,
          stream: false,
        })
        const batch = parseQuestionsFromResponse(response.content, `gen-${batchIndex}`)
        generated = [...generated, ...batch]
      } catch (err) {
        console.error('Batch generation failed:', err)
      }

      remaining -= batchCount
      batchIndex++
    }

    if (generated.length > 0) {
      setLocalQuestions((prev) => [...prev, ...generated])
    }

    setRunning(false)
    runningRef.current = false
    setPhase('idle')
    setProgress(null)
  }, [judgeProviderId, judgeModelId, activeProviderId, activeModelId, genCategories, genDifficultyMin, genDifficultyMax, genTotalCount, genBatchSize, localQuestions.length])

  const runEvaluation = useCallback(async () => {
    if (!activeSessionId || selectedQuestions.size === 0) return

    const localProvId = localProviderId || activeProviderId
    const localModId = localModelId || activeModelId
    const judgeProv = judgeProviderId || activeProviderId
    const judgeMod = judgeModelId || activeModelId
    const localProvider = providerRegistry.get(localProvId)
    const judgeProviderInst = providerRegistry.get(judgeProv)

    if (!localProvider || !judgeProviderInst) {
      alert('请确认被测模型和评判模型均已正确配置')
      return
    }

    setRunning(true)
    runningRef.current = true
    const questions = localQuestions.filter((q) => selectedQuestions.has(q.id))
    const maxPointsMap = computeMaxPoints(questions)
    setProgress({ completed: 0, total: questions.length })

    for (let i = 0; i < questions.length; i++) {
      if (!runningRef.current) break

      const question = questions[i]
      const maxPts = maxPointsMap.get(question.id) || 0

      try {
        setPhase('answering')
        const localStart = performance.now()
        let fullResponse = ''
        let tokenCount = 0

        const userMsg: ChatMessage = { id: generateId(), role: 'user', content: question.prompt, timestamp: Date.now() }

        const response = await localProvider.complete({
          model: localModId,
          messages: [userMsg],
          temperature: settings.temperature,
          topP: settings.topP,
          maxTokens: settings.maxTokens,
          stream: false,
        })

        fullResponse = response.content || ''
        tokenCount = response.usage?.completionTokens ?? 0

        const totalDuration = performance.now() - localStart
        if (tokenCount === 0) tokenCount = Math.ceil(fullResponse.length / 3.5)
        const tokensPerSecond = totalDuration > 0 ? (tokenCount / (totalDuration / 1000)) : 0

        const trimmedResponse = fullResponse.trim()
        const isResponseEmpty = trimmedResponse.length < 10

        let metrics: EvaluationMetrics
        let judgeFeedback = ''
        let overallScore = 0

        if (isResponseEmpty) {
          metrics = {
            speed: {
              ttfb: 0,
              tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
              totalDurationMs: Math.round(totalDuration),
              outputTokens: tokenCount,
            },
            quality: {
              relevance: 0,
              accuracy: 0,
              completeness: 0,
              clarity: 0,
              overall: 0,
            },
            score: 0,
            verdict: 'fail',
          }
          judgeFeedback = '被测试模型未给出有效回答，自动判定为0分'
        } else {
          setPhase('judging')
          const judgeSystemPrompt = `你是一个专业的AI模型评估专家。你需要评估以下AI回复的质量。

评估题目: ${question.prompt}
题目类别: ${CATEGORY_LABELS[question.category]}
期望考察点: ${question.expectedAspects.join('、') || '综合评估'}

AI的回复:
${fullResponse}

重要规则：如果AI的回复内容空洞、没有实质性的回答、完全答非所问、或仅为拒绝/无法回答的套话，则所有评分必须为0或1分，verdict必须为"fail"。

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

          const judgeMsg: ChatMessage = { id: generateId(), role: 'user', content: judgeSystemPrompt, timestamp: Date.now() }
          const judgeResponse = await judgeProviderInst.complete({
            model: judgeMod,
            messages: [judgeMsg],
            temperature: 0.3,
            maxTokens: 2000,
            stream: false,
          })

          try {
            const jsonStr = judgeResponse.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
            const parsed = JSON.parse(jsonStr)
            overallScore = Math.min(10, Math.max(0, parsed.overall || 0))
            metrics = {
              speed: {
                ttfb: 0,
                tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
                totalDurationMs: Math.round(totalDuration),
                outputTokens: tokenCount,
              },
              quality: {
                relevance: Math.min(10, Math.max(0, parsed.relevance || 0)),
                accuracy: Math.min(10, Math.max(0, parsed.accuracy || 0)),
                completeness: Math.min(10, Math.max(0, parsed.completeness || 0)),
                clarity: Math.min(10, Math.max(0, parsed.clarity || 0)),
                overall: overallScore,
              },
              score: overallScore,
              verdict: parsed.verdict || 'average',
            }
            judgeFeedback = parsed.feedback || ''
          } catch {
            overallScore = 0
            metrics = {
              speed: {
                ttfb: 0,
                tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
                totalDurationMs: Math.round(totalDuration),
                outputTokens: tokenCount,
              },
              quality: {
                relevance: 0,
                accuracy: 0,
                completeness: 0,
                clarity: 0,
                overall: 0,
              },
              score: 0,
              verdict: 'fail',
            }
            judgeFeedback = judgeResponse.content.slice(0, 500)
          }
        }

        const points = Math.round((overallScore / 10) * maxPts)

        const record: EvaluationRecord = {
          id: generateId(),
          questionId: question.id,
          question,
          localModel: localModId,
          localProvider: localProvId,
          response: fullResponse,
          metrics,
          maxPoints: Math.round(maxPts),
          points,
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
            score: 0,
            verdict: 'fail',
          },
          maxPoints: Math.round(maxPts),
          points: 0,
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

    computeAndUpdateSummary()

    setRunning(false)
    runningRef.current = false
    setPhase('done')
    setProgress(null)
  }, [activeSessionId, selectedQuestions, localQuestions, activeProviderId, activeModelId, localProviderId, localModelId, judgeProviderId, judgeModelId, settings])

  const computeAndUpdateSummary = useCallback(() => {
    if (!activeSessionId) return
    const session = useEvaluationStore.getState().sessions.find((s) => s.id === activeSessionId)
    if (!session || session.records.length === 0) return

    const records = session.records
    const totalScore = records.reduce((s, r) => s + r.points, 0)
    const maxScore = records.reduce((s, r) => s + r.maxPoints, 0)
    const pct = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
    const gradeInfo = getGrade(pct)

    const catMap = new Map<QuestionCategory, { score: number; max: number; count: number; qualitySum: number }>()
    const diffMap = new Map<DifficultyLevel, { score: number; max: number; count: number; qualitySum: number }>()
    for (const r of records) {
      const cat = r.question.category
      const diff = r.question.difficulty
      if (!catMap.has(cat)) catMap.set(cat, { score: 0, max: 0, count: 0, qualitySum: 0 })
      if (!diffMap.has(diff)) diffMap.set(diff, { score: 0, max: 0, count: 0, qualitySum: 0 })
      const cs = catMap.get(cat)!
      cs.score += r.points; cs.max += r.maxPoints; cs.count++; cs.qualitySum += r.metrics.quality.overall
      const ds = diffMap.get(diff)!
      ds.score += r.points; ds.max += r.maxPoints; ds.count++; ds.qualitySum += r.metrics.quality.overall
    }

    const categoryBreakdown: CategoryScore[] = Array.from(catMap.entries()).map(([category, v]) => ({
      category,
      score: Math.round(v.score),
      maxScore: Math.round(v.max),
      count: v.count,
      avgQuality: Math.round((v.qualitySum / v.count) * 10) / 10,
    }))

    const difficultyBreakdown: DifficultyScore[] = Array.from(diffMap.entries()).map(([difficulty, v]) => ({
      difficulty,
      score: Math.round(v.score),
      maxScore: Math.round(v.max),
      count: v.count,
      avgQuality: Math.round((v.qualitySum / v.count) * 10) / 10,
    }))

    const avgTtfb = records.reduce((s, r) => s + r.metrics.speed.ttfb, 0) / records.length
    const avgTps = records.reduce((s, r) => s + r.metrics.speed.tokensPerSecond, 0) / records.length
    const avgDur = records.reduce((s, r) => s + r.metrics.speed.totalDurationMs, 0) / records.length

    const verdictDistribution: Record<string, number> = {}
    for (const r of records) {
      verdictDistribution[r.metrics.verdict] = (verdictDistribution[r.metrics.verdict] || 0) + 1
    }

    const strengths: string[] = []
    const weaknesses: string[] = []
    for (const cb of categoryBreakdown) {
      const ratio = cb.maxScore > 0 ? cb.score / cb.maxScore : 0
      if (ratio >= 0.7) strengths.push(`${CATEGORY_LABELS[cb.category]}: 得分率 ${Math.round(ratio * 100)}%`)
      else if (ratio < 0.5) weaknesses.push(`${CATEGORY_LABELS[cb.category]}: 得分率 ${Math.round(ratio * 100)}%`)
    }
    if (avgTps >= 20) strengths.push(`生成速度快: ${avgTps.toFixed(1)} tokens/s`)
    else if (avgTps < 8) weaknesses.push(`生成速度较慢: ${avgTps.toFixed(1)} tokens/s`)
    if (avgTtfb < 1000) strengths.push(`首字延迟低: ${Math.round(avgTtfb)}ms`)
    else if (avgTtfb > 3000) weaknesses.push(`首字延迟高: ${Math.round(avgTtfb)}ms`)

    let overallVerdict: EvaluationSummary['overallVerdict'] = 'average'
    if (pct >= 90) overallVerdict = 'excellent'
    else if (pct >= 75) overallVerdict = 'good'
    else if (pct >= 50) overallVerdict = 'average'
    else if (pct >= 30) overallVerdict = 'poor'
    else overallVerdict = 'fail'

    const summary: EvaluationSummary = {
      totalScore: Math.round(totalScore),
      maxScore: Math.round(maxScore),
      grade: gradeInfo.grade,
      categoryBreakdown,
      difficultyBreakdown,
      avgSpeed: { ttfb: Math.round(avgTtfb), tokensPerSecond: Math.round(avgTps * 10) / 10, totalDurationMs: Math.round(avgDur) },
      verdictDistribution,
      overallVerdict,
      strengths,
      weaknesses,
    }

    updateSessionSummary(activeSessionId, summary)
  }, [activeSessionId, updateSessionSummary])

  const stopEvaluation = () => {
    runningRef.current = false
    setRunning(false)
    setPhase('idle')
    setProgress(null)
  }

  const exportQuestionBank = () => {
    const bank: QuestionBankFile = {
      name: `题库 ${new Date().toLocaleDateString('zh-CN')}`,
      version: 1,
      createdAt: Date.now(),
      questions: localQuestions.map(({ id, ...rest }) => rest),
    }
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `question-bank-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importQuestionBank = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const bank: QuestionBankFile = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(bank.questions)) throw new Error('invalid')
        const imported: TestQuestion[] = bank.questions.map((q, i) => ({
          id: `import-${Date.now()}-${i}`,
          category: ALL_CATEGORIES.includes(q.category) ? q.category : 'reasoning',
          prompt: q.prompt || '',
          expectedAspects: q.expectedAspects || [],
          difficulty: (DIFFICULTY_LEVELS.includes(q.difficulty) ? q.difficulty : 3) as DifficultyLevel,
        }))
        setLocalQuestions((prev) => [...prev, ...imported])
      } catch {
        alert('题库文件格式无效')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
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
              onClick={() => { setActiveSession(session.id); setLocalQuestions([]) }}
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
              {(['questions', 'results', 'summary', 'notes'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    tab === t ? 'bg-surface-700 text-primary-300' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800'
                  }`}
                >
                  {t === 'questions' ? '题库' : t === 'results' ? '结果' : t === 'summary' ? '总结' : '笔记'}
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
                  phase={phase}
                  currentProgress={currentProgress}
                  enabledProviders={enabledProviders}
                  localProviders={localProviders}
                  localProviderId={localProviderId}
                  localModelId={localModelId}
                  judgeProviderId={judgeProviderId}
                  judgeModelId={judgeModelId}
                  activeProviderId={activeProviderId}
                  activeModelId={activeModelId}
                  genCategories={genCategories}
                  genDifficultyMin={genDifficultyMin}
                  genDifficultyMax={genDifficultyMax}
                  genTotalCount={genTotalCount}
                  genBatchSize={genBatchSize}
                  evalBatchSize={evalBatchSize}
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
                  onGenerate={generateQuestions}
                  onLocalProvider={setLocalProviderId}
                  onLocalModel={setLocalModelId}
                  onJudgeProvider={setJudgeProviderId}
                  onJudgeModel={setJudgeModelId}
                  onToggleGenCategory={toggleGenCategory}
                  onGenDifficultyMin={setGenDifficultyMin}
                  onGenDifficultyMax={setGenDifficultyMax}
                  onGenTotalCount={setGenTotalCount}
                  onGenBatchSize={setGenBatchSize}
                  onEvalBatchSize={setEvalBatchSize}
                  onExportBank={exportQuestionBank}
                  onImportBank={importQuestionBank}
                  onClearQuestions={() => setLocalQuestions([])}
                  fileInputRef={fileInputRef}
                />
              )}
              {tab === 'results' && (
                <ResultsTab
                  records={activeSession.records}
                  expandedRecord={expandedRecord}
                  onToggleRecord={setExpandedRecord}
                  onUpdateNotes={updateRecordNotes}
                  onDeleteRecord={(recordId) => deleteRecord(activeSession.id, recordId)}
                  onClearRecords={() => clearRecords(activeSession.id)}
                  sessionId={activeSession.id}
                />
              )}
              {tab === 'summary' && (
                <SummaryTab session={activeSession} onRecompute={computeAndUpdateSummary} />
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
                自动生成题库、评估本地模型的回答质量和生成速度
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-surface-600">
                {['自动生成题库', '批量评估', '百分制评分', '分类总结', '题库导入导出'].map((f) => (
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
  difficultyFilter: DifficultyLevel | 'all'
  customPrompt: string
  customCategory: QuestionCategory
  customDifficulty: DifficultyLevel
  isRunning: boolean
  phase: string
  currentProgress: { completed: number; total: number } | null
  enabledProviders: { id: string; name: string; models: { id: string; name: string }[]; apiKey: string }[]
  localProviders: { id: string; name: string; models: { id: string; name: string }[] }[]
  localProviderId: string
  localModelId: string
  judgeProviderId: string
  judgeModelId: string
  activeProviderId: string
  activeModelId: string
  genCategories: Set<QuestionCategory>
  genDifficultyMin: DifficultyLevel
  genDifficultyMax: DifficultyLevel
  genTotalCount: number
  genBatchSize: number
  evalBatchSize: number
  onToggleQuestion: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onCategoryFilter: (f: QuestionCategory | 'all') => void
  onDifficultyFilter: (f: DifficultyLevel | 'all') => void
  onCustomPrompt: (v: string) => void
  onCustomCategory: (v: QuestionCategory) => void
  onCustomDifficulty: (v: DifficultyLevel) => void
  onAddCustomQuestion: () => void
  onRun: () => void
  onStop: () => void
  onGenerate: () => void
  onLocalProvider: (v: string) => void
  onLocalModel: (v: string) => void
  onJudgeProvider: (v: string) => void
  onJudgeModel: (v: string) => void
  onToggleGenCategory: (c: QuestionCategory) => void
  onGenDifficultyMin: (v: DifficultyLevel) => void
  onGenDifficultyMax: (v: DifficultyLevel) => void
  onGenTotalCount: (v: number) => void
  onGenBatchSize: (v: number) => void
  onEvalBatchSize: (v: number) => void
  onExportBank: () => void
  onImportBank: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearQuestions: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
}

const QuestionsTab: React.FC<QuestionsTabProps> = ({
  questions, localQuestions, selectedQuestions, categoryFilter, difficultyFilter,
  customPrompt, customCategory, customDifficulty,
  isRunning, phase, currentProgress, enabledProviders, localProviders,
  localProviderId, localModelId, judgeProviderId, judgeModelId, activeProviderId, activeModelId,
  genCategories, genDifficultyMin, genDifficultyMax, genTotalCount, genBatchSize, evalBatchSize,
  onToggleQuestion, onSelectAll, onDeselectAll,
  onCategoryFilter, onDifficultyFilter,
  onCustomPrompt, onCustomCategory, onCustomDifficulty,
  onAddCustomQuestion, onRun, onStop, onGenerate,
  onLocalProvider, onLocalModel, onJudgeProvider, onJudgeModel,
  onToggleGenCategory, onGenDifficultyMin, onGenDifficultyMax,
  onGenTotalCount, onGenBatchSize, onEvalBatchSize,
  onExportBank, onImportBank, onClearQuestions, fileInputRef,
}) => {
  const localProv = localProviders.find((p) => p.id === (localProviderId || activeProviderId))
  const judgeProv = enabledProviders.find((p) => p.id === (judgeProviderId || activeProviderId))

  const phaseLabel = phase === 'generating' ? '正在生成题目...' : phase === 'answering' ? '模型作答中...' : phase === 'judging' ? '评判评分中...' : '处理中...'

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

      <div className="bg-surface-900 border border-surface-700 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-surface-200">
            <Wand2 size={14} />
            <span>自动生成题库</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onExportBank} disabled={localQuestions.length === 0} className="flex items-center gap-1 px-2 py-1 text-xs text-surface-400 hover:text-surface-200 bg-surface-800 rounded disabled:opacity-30 transition-colors">
              <Download size={11} /> 导出题库
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2 py-1 text-xs text-surface-400 hover:text-surface-200 bg-surface-800 rounded transition-colors">
              <Upload size={11} /> 导入题库
            </button>
            <input ref={fileInputRef as React.Ref<HTMLInputElement>} type="file" accept=".json" className="hidden" onChange={onImportBank} />
          </div>
        </div>
        <div>
          <div className="text-xs text-surface-500 mb-1.5">题目类别（可多选）</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => onToggleGenCategory(c)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  genCategories.has(c) ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-surface-500 mb-1 block">最低难度</label>
            <select
              value={genDifficultyMin}
              onChange={(e) => {
                const v = Number(e.target.value) as DifficultyLevel
                onGenDifficultyMin(v)
                if (v > genDifficultyMax) onGenDifficultyMax(v)
              }}
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none"
            >
              {DIFFICULTY_LEVELS.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500 mb-1 block">最高难度</label>
            <select
              value={genDifficultyMax}
              onChange={(e) => {
                const v = Number(e.target.value) as DifficultyLevel
                onGenDifficultyMax(v)
                if (v < genDifficultyMin) onGenDifficultyMin(v)
              }}
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none"
            >
              {DIFFICULTY_LEVELS.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500 mb-1 block">题目总数</label>
            <input
              type="number"
              min={1}
              max={100}
              value={genTotalCount}
              onChange={(e) => onGenTotalCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-500 mb-1 block">每批数量</label>
            <select
              value={genBatchSize}
              onChange={(e) => onGenBatchSize(Number(e.target.value))}
              className="w-full bg-surface-850 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none"
            >
              {BATCH_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s} 题/批</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning && phase === 'generating' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            生成题库
          </button>
          {localQuestions.length > 0 && (
            <>
              <span className="text-xs text-surface-500">当前 {localQuestions.length} 题</span>
              <button onClick={onClearQuestions} className="text-xs text-red-400 hover:text-red-300">清空</button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilter(e.target.value as QuestionCategory | 'all')}
          className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none"
        >
          <option value="all">全部类别</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => onDifficultyFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as DifficultyLevel))}
          className="bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-surface-300 focus:outline-none"
        >
          <option value="all">全部难度</option>
          {DIFFICULTY_LEVELS.map((d) => (
            <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
          ))}
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
                <span className={`text-xs px-1.5 py-0.5 rounded bg-surface-800 ${DIFFICULTY_COLORS[q.difficulty]}`}>
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
        <div className="text-sm font-medium text-surface-200">手动添加题目</div>
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
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <select
            value={customDifficulty}
            onChange={(e) => onCustomDifficulty(Number(e.target.value) as DifficultyLevel)}
            className="bg-surface-850 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:outline-none"
          >
            {DIFFICULTY_LEVELS.map((d) => (
              <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
            ))}
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
                <span className="text-surface-300">{phaseLabel}</span>
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-surface-500">每批评估</span>
              <select
                value={evalBatchSize}
                onChange={(e) => onEvalBatchSize(Number(e.target.value))}
                className="bg-surface-800 border border-surface-700 rounded px-1.5 py-1 text-xs text-surface-300 focus:outline-none"
              >
                {BATCH_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s} 题</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-surface-500">
              百分制评分 · 已选 {selectedQuestions.size} 题
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
  onClearRecords: () => void
  sessionId: string
}

const ResultsTab: React.FC<ResultsTabProps> = ({
  records, expandedRecord, onToggleRecord, onUpdateNotes, onDeleteRecord, onClearRecords, sessionId,
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

  const totalPoints = records.reduce((s, r) => s + r.points, 0)
  const totalMax = records.reduce((s, r) => s + r.maxPoints, 0)
  const avgSpeed = records.reduce((sum, r) => sum + r.metrics.speed.tokensPerSecond, 0) / records.length
  const avgQuality = records.reduce((sum, r) => sum + r.metrics.quality.overall, 0) / records.length
  const avgTtfb = records.reduce((sum, r) => sum + r.metrics.speed.ttfb, 0) / records.length
  const pct = totalMax > 0 ? (totalPoints / totalMax) * 100 : 0
  const gradeInfo = getGrade(pct)

  const verdictCounts = records.reduce((acc, r) => {
    acc[r.metrics.verdict] = (acc[r.metrics.verdict] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <StatCard icon={<Trophy size={16} />} label="总得分" value={`${Math.round(totalPoints)}/${Math.round(totalMax)}`} color={gradeInfo.color} />
        <StatCard icon={<Star size={16} />} label="得分率" value={`${pct.toFixed(1)}%`} color={gradeInfo.color} />
        <StatCard icon={<Gauge size={16} />} label="平均速度" value={`${avgSpeed.toFixed(1)} t/s`} color="text-blue-400" />
        <StatCard icon={<Clock size={16} />} label="平均首字" value={`${avgTtfb.toFixed(0)} ms`} color="text-cyan-400" />
        <StatCard icon={<FileText size={16} />} label="总记录" value={`${records.length} 条`} color="text-surface-300" />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</span>
        <span className={`text-sm ${gradeInfo.color}`}>{gradeInfo.label}</span>
        <span className="text-xs text-surface-700">|</span>
        {Object.entries(verdictCounts).map(([verdict, count]) => (
          <span key={verdict} className={`text-xs px-2 py-0.5 rounded bg-surface-800 ${VERDICT_COLORS[verdict] || 'text-surface-400'}`}>
            {VERDICT_LABELS[verdict] || verdict} {count}
          </span>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => { if (window.confirm('确定要清空所有评估记录吗？此操作不可撤销。')) onClearRecords() }}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 size={12} />
          清空记录
        </button>
      </div>

      <div className="space-y-2">
        {records.map((record) => {
          const expanded = expandedRecord === record.id
          const rPct = record.maxPoints > 0 ? (record.points / record.maxPoints * 100) : 0
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
                  <div className="text-right min-w-[60px]">
                    <div className="text-sm font-medium">{record.points}/{record.maxPoints}</div>
                    <div className={`text-xs ${rPct >= 70 ? 'text-green-400' : rPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{rPct.toFixed(0)}%</div>
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
                    <div className="text-xs font-medium text-surface-400 mb-1.5">得分: {record.points}/{record.maxPoints} ({rPct.toFixed(1)}%)</div>
                    <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${rPct >= 70 ? 'bg-green-500' : rPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, rPct)}%` }}
                      />
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

interface SummaryTabProps {
  session: { id: string; records: EvaluationRecord[]; summary: EvaluationSummary | null; name: string }
  onRecompute: () => void
}

const SummaryTab: React.FC<SummaryTabProps> = ({ session, onRecompute }) => {
  if (session.records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <BarChart3 size={36} className="mx-auto text-surface-700" />
          <p className="text-sm text-surface-500">完成评测后将自动生成总结报告</p>
        </div>
      </div>
    )
  }

  const s = session.summary
  if (!s) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <BarChart3 size={36} className="mx-auto text-surface-700" />
          <p className="text-sm text-surface-500">尚未生成总结</p>
          <button onClick={onRecompute} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-500">
            生成总结
          </button>
        </div>
      </div>
    )
  }

  const pct = s.maxScore > 0 ? (s.totalScore / s.maxScore) * 100 : 0
  const gradeInfo = getGrade(pct)

  return (
    <div className="p-4 space-y-4">
      <div className="bg-surface-900 border border-surface-700 rounded-lg p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-5xl font-black ${gradeInfo.color}`}>{gradeInfo.grade}</div>
          <div>
            <div className="text-xl font-bold text-surface-100">{s.totalScore} / {s.maxScore}</div>
            <div className={`text-sm ${gradeInfo.color}`}>{pct.toFixed(1)}% · {gradeInfo.label}</div>
          </div>
          <div className="flex-1" />
          <button onClick={onRecompute} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-surface-400 hover:text-surface-200 bg-surface-800 rounded-lg transition-colors">
            <RefreshCw size={12} /> 刷新
          </button>
        </div>
        <div className="h-3 bg-surface-800 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-surface-500">平均速度</div>
            <div className="text-sm font-medium text-blue-400">{s.avgSpeed.tokensPerSecond} t/s</div>
          </div>
          <div>
            <div className="text-xs text-surface-500">平均首字</div>
            <div className="text-sm font-medium text-cyan-400">{s.avgSpeed.ttfb} ms</div>
          </div>
          <div>
            <div className="text-xs text-surface-500">平均耗时</div>
            <div className="text-sm font-medium text-surface-300">{s.avgSpeed.totalDurationMs} ms</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-900 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-surface-200 mb-3">
            <Target size={14} />
            <span>分类得分</span>
          </div>
          <div className="space-y-2.5">
            {s.categoryBreakdown.map((cb) => {
              const ratio = cb.maxScore > 0 ? (cb.score / cb.maxScore) * 100 : 0
              return (
                <div key={cb.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-surface-300">{CATEGORY_LABELS[cb.category]}</span>
                    <span className="text-surface-400">{cb.score}/{cb.maxScore} · 质量 {cb.avgQuality}/10</span>
                  </div>
                  <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ratio >= 70 ? 'bg-green-500' : ratio >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, ratio)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-surface-900 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-surface-200 mb-3">
            <TrendingUp size={14} />
            <span>难度得分</span>
          </div>
          <div className="space-y-2.5">
            {s.difficultyBreakdown.sort((a, b) => a.difficulty - b.difficulty).map((db) => {
              const ratio = db.maxScore > 0 ? (db.score / db.maxScore) * 100 : 0
              return (
                <div key={db.difficulty}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={DIFFICULTY_COLORS[db.difficulty]}>{DIFFICULTY_LABELS[db.difficulty]}</span>
                    <span className="text-surface-400">{db.score}/{db.maxScore} · {db.count}题 · 质量 {db.avgQuality}/10</span>
                  </div>
                  <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ratio >= 70 ? 'bg-green-500' : ratio >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, ratio)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-900 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-green-400 mb-3">
            <Zap size={14} />
            <span>优势 ({s.strengths.length})</span>
          </div>
          {s.strengths.length > 0 ? (
            <ul className="space-y-1">
              {s.strengths.map((st, i) => (
                <li key={i} className="text-xs text-surface-300 flex items-start gap-1.5">
                  <span className="text-green-400 mt-0.5">+</span> {st}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-surface-600">暂无明显优势</p>
          )}
        </div>

        <div className="bg-surface-900 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-400 mb-3">
            <AlertCircle size={14} />
            <span>不足 ({s.weaknesses.length})</span>
          </div>
          {s.weaknesses.length > 0 ? (
            <ul className="space-y-1">
              {s.weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-surface-300 flex items-start gap-1.5">
                  <span className="text-orange-400 mt-0.5">-</span> {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-surface-600">暂无明显不足</p>
          )}
        </div>
      </div>

      <div className="bg-surface-900 border border-surface-700 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-200 mb-3">
          <BarChart3 size={14} />
          <span>评级分布</span>
        </div>
        <div className="flex items-center gap-3">
          {(['excellent', 'good', 'average', 'poor', 'fail'] as const).map((v) => {
            const count = s.verdictDistribution[v] || 0
            return (
              <div key={v} className="flex-1 text-center">
                <div className={`text-lg font-bold ${VERDICT_COLORS[v]}`}>{count}</div>
                <div className="text-xs text-surface-500">{VERDICT_LABELS[v]}</div>
              </div>
            )
          })}
        </div>
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
                <span className="text-xs text-surface-600">{record.points}/{record.maxPoints}</span>
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
