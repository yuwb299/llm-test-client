import React, { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

interface CodeBlockProps {
  language: string
  code: string
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(code.split('\n').length > 20)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayCode = collapsed ? code.split('\n').slice(0, 20).join('\n') + '\n...' : code
  const lineCount = code.split('\n').length

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-surface-700 bg-surface-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-800 text-xs text-surface-400">
        <span className="font-mono">{language || 'text'}</span>
        <div className="flex items-center gap-2">
          <span>{lineCount} lines</span>
          {lineCount > 20 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-0.5 hover:text-surface-200 transition-colors"
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-0.5 hover:text-surface-200 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <pre className="!m-0 !rounded-none !border-0">
        <code className={`language-${language || 'text'} !bg-transparent`}>
          {displayCode}
        </code>
      </pre>
    </div>
  )
}
