import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useState, useCallback } from "react"
import type { Connection, Screen } from "../types.ts"
import { loadConfig, deleteConnection as removeConnection } from "../lib/config.ts"
import { AddConnectionModal } from "../components/add-connection-modal.tsx"

interface Props {
  onNavigate: (screen: Screen) => void
}

export function ConnectionsScreen({ onNavigate }: Props) {
  const renderer = useRenderer()
  const { height } = useTerminalDimensions()
  const [connections, setConnections] = useState<Connection[]>(() => loadConfig().connections)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshConnections = useCallback(() => {
    setConnections(loadConfig().connections)
  }, [])

  useKeyboard((key) => {
    if (showAddModal) return

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
    } else if (key.name === "d") {
      if (connections.length > 0 && connections[selectedIndex]) {
        removeConnection(connections[selectedIndex].name)
        refreshConnections()
        setSelectedIndex((i: number) => Math.max(0, Math.min(i, connections.length - 2)))
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

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="column" padding={1} flexGrow={1}>
        <text fg="#7aa2f7">
          {"  "}ROOK
        </text>
        <text>{""}</text>
        <text fg="#565f89">{"  "}Connections</text>
        <text>{""}</text>

        {connections.length === 0 ? (
          <text fg="#565f89">{"  "}No connections saved. Press 'a' to add one.</text>
        ) : (
          connections.map((conn: Connection, i: number) => (
            <text
              key={conn.name}
              fg={i === selectedIndex ? "#c0caf5" : "#565f89"}
              bg={i === selectedIndex ? "#283457" : undefined}
            >
              {"  "}{i === selectedIndex ? "› " : "  "}{conn.name}
              <span fg="#565f89">
                {" "}({conn.host}:{conn.port}/{conn.database})
              </span>
            </text>
          ))
        )}

        {error && (
          <box marginTop={1}>
            <text fg="#f7768e">{"  "}{error}</text>
          </box>
        )}
      </box>

      <box
        width="100%"
        height={1}
        backgroundColor="#1a1b26"
        flexDirection="row"
        paddingX={1}
        gap={2}
      >
        <text fg="#565f89">
          <span fg="#7aa2f7">a</span> Add{"  "}
          <span fg="#7aa2f7">d</span> Delete{"  "}
          <span fg="#7aa2f7">Enter</span> Connect{"  "}
          <span fg="#7aa2f7">q</span> Quit
        </text>
      </box>

      {showAddModal && (
        <AddConnectionModal onSave={handleSave} onCancel={handleCancel} />
      )}
    </box>
  )
}
