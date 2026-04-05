import React, { useState } from 'react'
import { X, FileText, FileJson, FileCode, FileImage, File } from 'lucide-react'
import { Conversation } from '@/types/message'
import { ExportFormat, ExportOptions } from '@/types'
import { exportConversation } from '@/services/export'

interface ExportDialogProps {
  conversation: Conversation
  onClose: () => void
}

const formats: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'markdown', label: 'Markdown', icon: <FileText size={18} />, desc: '.md file with formatting' },
  { id: 'html', label: 'HTML', icon: <FileCode size={18} />, desc: 'Self-contained HTML page' },
  { id: 'json', label: 'JSON', icon: <FileJson size={18} />, desc: 'Structured data export' },
  { id: 'pdf', label: 'PDF', icon: <File size={18} />, desc: 'Printable document' },
  { id: 'png', label: 'Screenshot', icon: <FileImage size={18} />, desc: 'Screenshot of chat' },
]

export const ExportDialog: React.FC<ExportDialogProps> = ({ conversation, onClose }) => {
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeTokens, setIncludeTokens] = useState(true)
  const [includeTimestamps, setIncludeTimestamps] = useState(true)

  const handleExport = () => {
    const options: ExportOptions = {
      format,
      includeMetadata,
      includeTokenUsage: includeTokens,
      includeTimestamps,
    }
    exportConversation(conversation, options)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-2xl w-96" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <h3 className="text-sm font-semibold text-surface-200">Export Conversation</h3>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-300">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {formats.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  format === f.id
                    ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                    : 'border-surface-700 hover:border-surface-600 text-surface-400'
                }`}
              >
                {f.icon}
                <div>
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs opacity-60">{f.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-surface-400 cursor-pointer">
              <input type="checkbox" checked={includeMetadata} onChange={(e) => setIncludeMetadata(e.target.checked)} className="rounded" />
              Include metadata (model, provider)
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-400 cursor-pointer">
              <input type="checkbox" checked={includeTokens} onChange={(e) => setIncludeTokens(e.target.checked)} className="rounded" />
              Include token usage
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-400 cursor-pointer">
              <input type="checkbox" checked={includeTimestamps} onChange={(e) => setIncludeTimestamps(e.target.checked)} className="rounded" />
              Include timestamps
            </label>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-surface-700">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg bg-surface-700 text-surface-300 text-sm hover:bg-surface-600 transition-colors">
            Cancel
          </button>
          <button onClick={handleExport} className="flex-1 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-500 transition-colors">
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
