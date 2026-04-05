import React from 'react'

export const MCPPanel: React.FC = () => {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-surface-200 mb-3">MCP Servers</h3>
      <p className="text-xs text-surface-500">
        Model Context Protocol enables tool use via external servers.
        Configure your MCP servers to enable this feature.
      </p>
    </div>
  )
}
