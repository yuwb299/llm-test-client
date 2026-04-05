import React from 'react'
import { X } from 'lucide-react'
import { FileAttachment as FileAttachmentType } from '@/types/message'
import { formatFileSize } from '@/utils/helpers'

interface FileAttachmentProps {
  attachment: FileAttachmentType
  onRemove: (id: string) => void
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ attachment, onRemove }) => {
  return (
    <div className="relative group flex items-center gap-2 bg-surface-800 rounded-lg px-2 py-1.5 border border-surface-700">
      {attachment.preview ? (
        <img src={attachment.preview} alt={attachment.name} className="w-10 h-10 rounded object-cover" />
      ) : (
        <div className="w-10 h-10 rounded bg-surface-700 flex items-center justify-center text-xs text-surface-400">
          {attachment.type.split('/')[1]?.toUpperCase()?.slice(0, 4) || 'FILE'}
        </div>
      )}
      <div className="text-xs">
        <div className="text-surface-300 max-w-[120px] truncate">{attachment.name}</div>
        <div className="text-surface-500">{formatFileSize(attachment.size)}</div>
      </div>
      <button
        onClick={() => onRemove(attachment.id)}
        className="absolute -top-1 -right-1 w-4 h-4 bg-surface-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-600"
      >
        <X size={10} />
      </button>
    </div>
  )
}
