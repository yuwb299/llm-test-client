import React, { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, Square, Sparkles, X } from 'lucide-react'
import { FileAttachment } from './FileAttachment'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { skillRegistry } from '@/skills'
import { ContentPart, FileAttachment as FileAttachmentType } from '@/types/message'
import { generateId, readFileAsBase64, getImagePreview, isImageFile, formatFileSize } from '@/utils/helpers'
import { countTokens } from '@/services/token-counter'

interface InputAreaProps {
  onSend: (content: string | ContentPart[], skillId?: string) => void
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend }) => {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<FileAttachmentType[]>([])
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const [inputTokens, setInputTokens] = useState(0)
  const [showSkills, setShowSkills] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const settings = useSettingsStore((s) => s.settings)
  const { isStreaming } = useChatStore()

  const skills = skillRegistry.getAll()

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    countTokens(val).then(setInputTokens)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && settings.sendOnEnter) {
        e.preventDefault()
        handleSend()
      }
    },
    [text, settings.sendOnEnter]
  )

  const handleSend = useCallback(() => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return

    if (attachments.length > 0) {
      const parts: ContentPart[] = []
      if (text.trim()) parts.push({ type: 'text', text: text.trim() })
      for (const att of attachments) {
        if (att.type.startsWith('image/')) {
          parts.push({
            type: 'image',
            imageData: { data: att.data, mimeType: att.type },
          })
        }
      }
      onSend(parts.length === 1 && parts[0].type === 'text' ? (parts[0].text as string) : parts, activeSkill || undefined)
    } else {
      onSend(text.trim(), activeSkill || undefined)
    }

    setText('')
    setAttachments([])
    setActiveSkill(null)
    setInputTokens(0)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, attachments, isStreaming, activeSkill, onSend])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) continue

      const data = await readFileAsBase64(file)
      const preview = isImageFile(file) ? await getImagePreview(file) : undefined

      setAttachments((prev) => [
        ...prev,
        {
          id: generateId(),
          name: file.name,
          type: file.type,
          size: file.size,
          data,
          preview,
        },
      ])
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return (
    <div className="border-t border-surface-700 bg-surface-900 p-3">
      {activeSkill && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-primary-500/10 rounded-lg text-sm text-primary-300">
          <Sparkles size={14} />
          <span>{skillRegistry.get(activeSkill)?.name}</span>
          <button onClick={() => setActiveSkill(null)} className="ml-auto hover:text-primary-200">
            <X size={14} />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att) => (
            <FileAttachment key={att.id} attachment={att} onRemove={removeAttachment} />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,audio/*,.txt,.md,.json,.csv,.pdf"
            onChange={handleFileSelect}
          />
          <div className="relative">
            <button
              onClick={() => setShowSkills(!showSkills)}
              className={`p-2 rounded-lg hover:bg-surface-800 transition-colors ${activeSkill ? 'text-primary-400' : 'text-surface-400 hover:text-surface-200'}`}
              title="Skills"
            >
              <Sparkles size={18} />
            </button>
            {showSkills && (
              <div className="absolute bottom-full left-0 mb-1 w-64 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50">
                <div className="p-2 text-xs text-surface-400 border-b border-surface-700">Skills</div>
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      setActiveSkill(skill.id)
                      setShowSkills(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 flex items-center gap-2 transition-colors ${activeSkill === skill.id ? 'bg-surface-700 text-primary-300' : 'text-surface-300'}`}
                  >
                    <span>{skill.icon}</span>
                    <div>
                      <div className="font-medium">{skill.name}</div>
                      <div className="text-xs text-surface-500">{skill.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={settings.sendOnEnter ? 'Type a message (Enter to send, Shift+Enter for new line)...' : 'Type a message...'}
            className="w-full resize-none rounded-lg bg-surface-850 border border-surface-700 px-3 py-2.5 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500 transition-colors"
            rows={1}
            style={{ maxHeight: '200px' }}
          />
        </div>

        <button
          onClick={isStreaming ? undefined : handleSend}
          disabled={(!text.trim() && attachments.length === 0) || isStreaming}
          className={`p-2.5 rounded-lg transition-colors ${
            isStreaming
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {isStreaming ? <Square size={18} /> : <Send size={18} />}
        </button>
      </div>

      {settings.showTokenCount && text.trim() && (
        <div className="flex justify-end mt-1 text-xs text-surface-500">
          ~{inputTokens} tokens
        </div>
      )}
    </div>
  )
}
