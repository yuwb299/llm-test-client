import { Conversation, ChatMessage } from '@/types/message'
import { ExportFormat, ExportOptions } from '@/types'

function conversationToMarkdown(conv: Conversation, options: ExportOptions): string {
  const lines: string[] = [`# ${conv.title}`, '']
  if (options.includeMetadata) {
    lines.push(`> Model: ${conv.model} | Provider: ${conv.provider}`)
    if (options.includeTimestamps) {
      lines.push(`> Created: ${new Date(conv.createdAt).toLocaleString()}`)
    }
    lines.push('')
  }

  for (const msg of conv.messages) {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1)
    const ts = options.includeTimestamps ? ` _${new Date(msg.timestamp).toLocaleTimeString()}_` : ''
    lines.push(`## ${role}${ts}`, '')

    const content = typeof msg.content === 'string' ? msg.content : msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
    lines.push(content, '')

    if (options.includeTokenUsage && msg.usage) {
      lines.push(`_Tokens: ${msg.usage.promptTokens}+${msg.usage.completionTokens}=${msg.usage.totalTokens}_`, '')
    }
  }

  return lines.join('\n')
}

function conversationToHtml(conv: Conversation, options: ExportOptions): string {
  const meta = options.includeMetadata
    ? `<div class="meta"><p>Model: ${conv.model} | Provider: ${conv.provider}</p></div>`
    : ''

  const messages = conv.messages
    .map((msg) => {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1)
      const content = typeof msg.content === 'string' ? msg.content : msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
      const ts = options.includeTimestamps ? `<span class="ts">${new Date(msg.timestamp).toLocaleTimeString()}</span>` : ''
      const tokens = options.includeTokenUsage && msg.usage ? `<span class="tokens">Tokens: ${msg.usage.totalTokens}</span>` : ''
      return `<div class="msg msg-${msg.role}"><div class="role">${role} ${ts}</div><div class="content">${content}</div>${tokens}</div>`
    })
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${conv.title}</title>
<style>
body{font-family:system-ui;max-width:900px;margin:0 auto;padding:20px;background:#0f172a;color:#e2e8f0}
.meta{color:#94a3b8;margin-bottom:20px}
.msg{margin:16px 0;padding:12px;border-radius:8px;background:#1e293b}
.msg-user{border-left:3px solid #3b82f6}
.msg-assistant{border-left:3px solid #10b981}
.role{font-weight:bold;margin-bottom:8px}
.ts,.tokens{color:#64748b;font-size:0.85em;margin-left:8px}
.content{line-height:1.6;white-space:pre-wrap}
pre{background:#0f172a;padding:12px;border-radius:6px;overflow-x:auto}
code{font-family:'Fira Code',monospace;font-size:0.9em}
</style></head><body><h1>${conv.title}</h1>${meta}${messages}</body></html>`
}

function conversationToJson(conv: Conversation, options: ExportOptions): string {
  const data: Record<string, unknown> = {
    title: conv.title,
    model: conv.model,
    provider: conv.provider,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: conv.messages.map((msg) => {
      const obj: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      }
      if (options.includeTimestamps) obj.timestamp = msg.timestamp
      if (options.includeTokenUsage && msg.usage) obj.usage = msg.usage
      return obj
    }),
  }
  return JSON.stringify(data, null, 2)
}

export async function exportConversation(conv: Conversation, options: ExportOptions): Promise<void> {
  const filename = options.filename || `${conv.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}_${Date.now()}`

  switch (options.format) {
    case 'markdown': {
      const md = conversationToMarkdown(conv, options)
      downloadFile(`${filename}.md`, md, 'text/markdown')
      break
    }
    case 'html': {
      const html = conversationToHtml(conv, options)
      downloadFile(`${filename}.html`, html, 'text/html')
      break
    }
    case 'json': {
      const json = conversationToJson(conv, options)
      downloadFile(`${filename}.json`, json, 'application/json')
      break
    }
    case 'pdf': {
      const html = conversationToHtml(conv, options)
      const { default: jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      doc.html(html, {
        callback: (d) => d.save(`${filename}.pdf`),
        x: 10,
        y: 10,
        width: 180,
        windowWidth: 800,
      })
      break
    }
    case 'png': {
      const el = document.querySelector('#chat-messages')
      if (el) {
        const { default: html2canvas } = await import('html2canvas')
        const canvas = await html2canvas(el as HTMLElement, { backgroundColor: '#0f172a' })
        const link = document.createElement('a')
        link.download = `${filename}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      break
    }
  }
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
