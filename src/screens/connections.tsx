import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useState, useCallback } from "react"
import type { Connection, Screen } from "../types.ts"
import { loadConfig, deleteConnection as removeConnection } from "../lib/config.ts"
import { AddConnectionModal } from "../components/add-connection-modal.tsx"
import { ConfirmDialog } from "../components/confirm-dialog.tsx"
import { theme } from "../lib/theme.ts"

interface Props {
  onNavigate: (screen: Screen) => void
}

export function ConnectionsScreen({ onNavigate }: Props) {
  const renderer = useRenderer()
  const { height } = useTerminalDimensions()
  const [connections, setConnections] = useState<Connection[]>(() => loadConfig().connections)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshConnections = useCallback(() => {
    setConnections(loadConfig().connections)
  }, [])

  useKeyboard((key) => {
    if (showAddModal || showDeleteConfirm) return

    if (key.name === "q") {
      renderer.destroy()
      return
    }

    if (key.name === "j" || key.name === "down") {
      setSelectedIndex((i: number) => Math.min(i + 1, connections.length - 1))
    } else if (key.name === "k" || key.name === "up") {
      setSelectedIndex((i: number) => Math.max(i - 1, 0))
    } else if (key.name === "return") {
      if (connections.length > 0 && connections[selectedIndex]) {
        setError(null)
        onNavigate({ type: "explorer", connection: connections[selectedIndex] })
      }
    } else if (key.name === "a") {
      setShowAddModal(true)
    } else if (key.name === "d" && key.shift) {
      if (connections.length > 0 && connections[selectedIndex]) {
        setShowDeleteConfirm(true)
      }
    } else if (key.name === "g") {
      setSelectedIndex(0)
    } else if (key.shift && key.name === "g") {
      setSelectedIndex(Math.max(0, connections.length - 1))
    }
  })

  const handleSave = useCallback(() => {
    refreshConnections()
    setShowAddModal(false)
  }, [refreshConnections])

  const handleCancel = useCallback(() => {
    setShowAddModal(false)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    const conn = connections[selectedIndex]
    if (conn) {
      removeConnection(conn.name)
      refreshConnections()
      setSelectedIndex((i: number) => Math.max(0, Math.min(i, connections.length - 2)))
    }
    setShowDeleteConfirm(false)
  }, [connections, selectedIndex, refreshConnections])

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false)
  }, [])

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="column" padding={1} flexGrow={1}>
        <text fg={theme.accent}>
          {"  "}ROOK
        </text>
        <text>{""}</text>
        <text fg={theme.textDim}>{"  "}Connections</text>
        <text>{""}</text>

        {connections.length === 0 ? (
          <text fg={theme.textDim}>{"  "}No connections saved. Press 'a' to add one.</text>
        ) : (
          connections.map((conn: Connection, i: number) => (
            <text
              key={conn.name}
              fg={i === selectedIndex ? theme.text : theme.textDim}
              bg={i === selectedIndex ? theme.bgHighlight : undefined}
            >
              {"  "}{i === selectedIndex ? "› " : "  "}{conn.name}
              <span fg={theme.textDim}>
                {" "}({conn.host}:{conn.port}/{conn.database})
              </span>
            </text>
          ))
        )}

        {error && (
          <box marginTop={1}>
            <text fg={theme.error}>{"  "}{error}</text>
          </box>
        )}
      </box>

      <box
        width="100%"
        height={1}
        backgroundColor={theme.bg}
        flexDirection="row"
        paddingX={1}
        gap={2}
      >
        <text fg={theme.textDim}>
          <span fg={theme.accent}>a</span> Add{"  "}
          <span fg={theme.accent}>D</span> Delete{"  "}
          <span fg={theme.accent}>Enter</span> Connect{"  "}
          <span fg={theme.accent}>q</span> Quit
        </text>
      </box>

      {showAddModal && (
        <AddConnectionModal onSave={handleSave} onCancel={handleCancel} />
      )}

      {showDeleteConfirm && connections[selectedIndex] && (
        <ConfirmDialog
          message={`Delete connection "${connections[selectedIndex].name}"?`}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </box>
  )
}
