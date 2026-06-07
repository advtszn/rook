import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useState, useEffect, useCallback, useRef } from "react"
import type { Connection, Screen, TreeNode, ExplorerState } from "../types.ts"
import { connectToRedis, scanKeys, disconnectRedis, getClient, getKeyValue, getKeyTTL, formatTTL, deleteKey, deleteNamespace } from "../lib/redis.ts"
import { buildTree, getNodesAtPath, filterTree } from "../lib/tree.ts"
import { ConfirmDialog } from "../components/confirm-dialog.tsx"

interface Props {
  connection: Connection
  restoreState?: ExplorerState
  onNavigate: (screen: Screen) => void
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

function scrollForIndex(selected: number, viewHeight: number, currentScroll: number): number {
  if (selected < 0) return 0
  if (selected < currentScroll) return selected
  if (selected >= currentScroll + viewHeight) return selected - viewHeight + 1
  return Math.max(0, currentScroll)
}

interface Preview {
  type: string
  value: string
  ttl: string
}

export function ExplorerScreen({ connection, restoreState, onNavigate }: Props) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchMode, setSearchMode] = useState(false)

  const [path, setPath] = useState<number[]>(restoreState?.path ?? [])
  const [selectedIndex, setSelectedIndex] = useState(restoreState?.selectedIndex ?? 0)
  // remember selected index per path so going back restores position
  const selectedCache = useRef<Map<string, number>>(new Map())
  // scroll offsets per column
  const [leftScroll, setLeftScroll] = useState(0)
  const [midScroll, setMidScroll] = useState(0)
  const [rightScroll, setRightScroll] = useState(0)
  // delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ key: string; isNamespace: boolean } | null>(null)
  // preview for leaf nodes
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewKey, setPreviewKey] = useState<string | null>(null)

  const colHeight = height - 5

  const displayTree = searchQuery ? filterTree(tree, searchQuery) : tree

  // Derive columns from path
  const { parent: parentNodes, current: currentNodes } = getNodesAtPath(displayTree, path)
  const parentIndex = path.length > 0 ? path[path.length - 1]! : -1

  const safeSelected = currentNodes.length > 0 ? clamp(selectedIndex, 0, currentNodes.length - 1) : -1
  const selectedNode = safeSelected >= 0 ? currentNodes[safeSelected] ?? null : null
  const rightNodes = selectedNode ? selectedNode.children : []

  // Load preview for leaf nodes
  useEffect(() => {
    if (!selectedNode || selectedNode.children.length > 0) {
      setPreview(null)
      setPreviewKey(null)
      return
    }
    if (selectedNode.fullKey === previewKey) return

    let cancelled = false
    const client = getClient()
    if (!client) return

    setPreviewKey(selectedNode.fullKey)
    getKeyValue(client, selectedNode.fullKey).then(async (kv) => {
      if (cancelled) return
      const ttl = await getKeyTTL(client, selectedNode.fullKey)
      setPreview({ type: kv.type, value: kv.value, ttl: formatTTL(ttl) })
    }).catch(() => {
      if (!cancelled) setPreview(null)
    })
    return () => { cancelled = true }
  }, [selectedNode?.fullKey])

  // Reset mid scroll when path changes
  useEffect(() => {
    setMidScroll(0)
  }, [path.join(",")])

  // Keep mid scroll in sync with selection
  useEffect(() => {
    setMidScroll((s: number) => scrollForIndex(safeSelected, colHeight, s))
  }, [safeSelected, colHeight])

  // Reset right scroll when selection changes
  useEffect(() => {
    setRightScroll(0)
  }, [selectedNode?.fullKey])

  // Keep left scroll in sync with parent highlight
  useEffect(() => {
    if (parentIndex >= 0) {
      setLeftScroll((s: number) => scrollForIndex(parentIndex, colHeight, s))
    }
  }, [parentIndex, colHeight])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const client = connectToRedis(connection)
        await client.connect()
        const keys = await scanKeys(client)
        if (!cancelled) {
          setTree(buildTree(keys))
          setLoading(false)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Connection failed")
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [connection])

  const navigateRight = useCallback(() => {
    if (safeSelected < 0 || !selectedNode) return
    if (selectedNode.children.length > 0) {
      selectedCache.current.set(path.join(","), safeSelected)
      setPath((p: number[]) => [...p, safeSelected])
      const cachedIdx = selectedCache.current.get([...path, safeSelected].join(","))
      setSelectedIndex(cachedIdx ?? 0)
    } else if (selectedNode.isLeaf) {
      onNavigate({
        type: "inspector",
        connection,
        redisKey: selectedNode.fullKey,
        explorerState: { path, selectedIndex: safeSelected },
      })
    }
  }, [safeSelected, selectedNode, path, connection, onNavigate])

  const refreshTree = useCallback(async () => {
    const client = getClient()
    if (!client) return
    const keys = await scanKeys(client)
    setTree(buildTree(keys))
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    const client = getClient()
    if (!client || !confirmDelete) return
    if (confirmDelete.isNamespace) {
      await deleteNamespace(client, confirmDelete.key)
    } else {
      await deleteKey(client, confirmDelete.key)
    }
    setConfirmDelete(null)
    await refreshTree()
    setSelectedIndex((i: number) => clamp(i, 0, Math.max(0, currentNodes.length - 2)))
  }, [confirmDelete, currentNodes.length, refreshTree])

  const navigateLeft = useCallback(() => {
    if (path.length === 0) return
    const prevIdx = path[path.length - 1]!
    setPath((p: number[]) => p.slice(0, -1))
    setSelectedIndex(prevIdx)
  }, [path, onNavigate])

  useKeyboard((key) => {
    if (confirmDelete) return

    if (searchMode) {
      if (key.name === "escape") {
        setSearchMode(false)
        setSearchQuery("")
        return
      }
      if (key.name === "return") {
        setSearchMode(false)
        return
      }
      if (key.name === "backspace") {
        setSearchQuery((q: string) => q.slice(0, -1))
        setSelectedIndex(0)
        setPath([])
        return
      }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setSearchQuery((q: string) => q + key.sequence)
        setSelectedIndex(0)
        setPath([])
        return
      }
      return
    }

    if (key.name === "q" || key.name === "escape") {
      disconnectRedis()
      onNavigate({ type: "connections" })
      return
    }

    if (key.name === "j" || key.name === "down") {
      setSelectedIndex((i: number) => clamp(i + 1, 0, currentNodes.length - 1))
    } else if (key.name === "k" || key.name === "up") {
      setSelectedIndex((i: number) => clamp(i - 1, 0, currentNodes.length - 1))
    } else if (key.name === "l" || key.name === "right" || key.name === "return") {
      navigateRight()
    } else if (key.name === "h" || key.name === "left") {
      navigateLeft()
    } else if (key.name === "g" && !key.shift) {
      setSelectedIndex(0)
    } else if (key.name === "g" && key.shift) {
      setSelectedIndex(Math.max(0, currentNodes.length - 1))
    } else if (key.sequence === "/") {
      setSearchMode(true)
      setSearchQuery("")
      setPath([])
      setSelectedIndex(0)
    } else if (key.name === "d" && key.shift) {
      if (selectedNode) {
        const isNamespace = selectedNode.children.length > 0 && !selectedNode.isLeaf
        setConfirmDelete({ key: selectedNode.fullKey, isNamespace })
      }
    }
  })

  if (error) {
    return (
      <box flexDirection="column" width="100%" height="100%" padding={1}>
        <text fg="#f7768e">Unable to connect</text>
        <text>{""}</text>
        <text fg="#565f89">Host: {connection.host}</text>
        <text fg="#565f89">Port: {connection.port}</text>
        <text>{""}</text>
        <text fg="#565f89">{error}</text>
        <text>{""}</text>
        <text fg="#565f89">Press any key to return.</text>
      </box>
    )
  }

  if (loading) {
    return (
      <box flexDirection="column" width="100%" height="100%" padding={1}>
        <text fg="#7aa2f7">Connecting to {connection.name}...</text>
      </box>
    )
  }

  const atRoot = path.length === 0
  const colWidth = atRoot
    ? Math.floor((width - 2) / 2)
    : Math.floor((width - 2) / 3)

  // Build the path string
  const pathParts: string[] = [connection.name]
  let walkNodes = displayTree
  for (const idx of path) {
    const node = walkNodes[idx]
    if (!node) break
    pathParts.push(node.key)
    walkNodes = node.children
  }
  if (selectedNode) pathParts.push(selectedNode.key)
  const pathStr = pathParts.join(" / ")

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <box height={1} paddingX={1}>
        <text fg="#7aa2f7">{connection.name}</text>
      </box>

      <box flexDirection="row" flexGrow={1}>
        {/* Left column: parent (hidden at root) */}
        {!atRoot && (
          <Column
            nodes={parentNodes ?? []}
            highlightIndex={parentIndex}
            selectedIndex={-1}
            width={colWidth}
            maxItems={colHeight}
            scrollOffset={leftScroll}
            dimmed
            borderColor="#292e42"
          />
        )}

        {/* Middle column: current (focused) */}
        <Column
          nodes={currentNodes}
          highlightIndex={-1}
          selectedIndex={safeSelected}
          width={colWidth}
          maxItems={colHeight}
          scrollOffset={midScroll}
          dimmed={false}
          borderColor="#3b4261"
        />

        {/* Right column: preview */}
        {preview && selectedNode && selectedNode.children.length === 0 ? (
          <ValuePreview
            preview={preview}
            width={colWidth}
            maxItems={colHeight}
            scrollOffset={rightScroll}
            borderColor="#292e42"
          />
        ) : (
          <Column
            nodes={rightNodes}
            highlightIndex={-1}
            selectedIndex={-1}
            width={colWidth}
            maxItems={colHeight}
            scrollOffset={rightScroll}
            dimmed
            borderColor="#292e42"
          />
        )}
      </box>

      {/* Status bar */}
      <box width="100%" height={1} backgroundColor="#1a1b26" paddingX={1}>
        {searchMode ? (
          <text fg="#c0caf5">/{searchQuery}▎</text>
        ) : (
          <text fg="#565f89">
            {searchQuery && <span fg="#787c99">/{searchQuery}{"  "}</span>}
            <span fg="#7aa2f7">h</span>/<span fg="#7aa2f7">l</span> Navigate{"  "}
            <span fg="#7aa2f7">j</span>/<span fg="#7aa2f7">k</span> Select{"  "}
            <span fg="#7aa2f7">/</span> Search{"  "}
            <span fg="#7aa2f7">Enter</span> Open{"  "}
            <span fg="#7aa2f7">D</span> Delete{"  "}
            <span fg="#7aa2f7">q</span> Back
          </text>
        )}
      </box>

      {/* Path bar */}
      <box width="100%" height={1} backgroundColor="#1a1b26" paddingX={1}>
        <text fg="#565f89">{pathStr}</text>
      </box>

      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.isNamespace
            ? `Delete all keys under "${confirmDelete.key}:*"?`
            : `Delete key "${confirmDelete.key}"?`}
          detail={confirmDelete.isNamespace ? "This will delete all keys in this namespace." : undefined}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </box>
  )
}

interface ColumnProps {
  nodes: TreeNode[]
  highlightIndex: number
  selectedIndex: number
  width: number
  maxItems: number
  scrollOffset: number
  dimmed: boolean
  borderColor: string
}

function Column({ nodes, highlightIndex, selectedIndex, width, maxItems, scrollOffset, dimmed, borderColor }: ColumnProps) {
  const visible = nodes.slice(scrollOffset, scrollOffset + maxItems)

  return (
    <box
      width={width}
      flexGrow={1}
      flexShrink={1}
      style={{ borderStyle: "single", borderColor }}
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="flex-start"
    >
      {visible.length === 0 ? (
        <text fg="#3b4261">{"  "}(empty)</text>
      ) : (
        visible.map((node: TreeNode, vi: number) => {
          const actualIdx = scrollOffset + vi
          const isSelected = actualIdx === selectedIndex
          const isHighlighted = actualIdx === highlightIndex
          const hasChildren = node.children.length > 0
          const suffix = hasChildren ? "/" : ""

          let fg = dimmed ? "#565f89" : "#787c99"
          let bg: string | undefined
          if (isSelected) {
            fg = "#c0caf5"
            bg = "#283457"
          } else if (isHighlighted) {
            fg = "#7aa2f7"
            bg = "#1f2335"
          }

          return (
            <text key={`${node.fullKey}-${actualIdx}`} fg={fg} bg={bg}>
              {isSelected ? " › " : "   "}{node.key}{suffix}
            </text>
          )
        })
      )}
    </box>
  )
}

interface ValuePreviewProps {
  preview: Preview
  width: number
  maxItems: number
  scrollOffset: number
  borderColor: string
}

function ValuePreview({ preview, width, maxItems, scrollOffset, borderColor }: ValuePreviewProps) {
  const lines = preview.value.split("\n")
  const header = [
    `Type: ${preview.type}`,
    `TTL:  ${preview.ttl}`,
    "",
  ]
  const allLines = [...header, ...lines]
  const visible = allLines.slice(scrollOffset, scrollOffset + maxItems)

  return (
    <box
      width={width}
      flexGrow={1}
      style={{ borderStyle: "single", borderColor }}
      flexDirection="column"
    >
      {visible.map((line: string, i: number) => {
        const actualIdx = scrollOffset + i
        const isHeader = actualIdx < header.length
        return (
          <text key={actualIdx} fg={isHeader ? "#bb9af7" : "#787c99"}>
            {"  "}{line}
          </text>
        )
      })}
    </box>
  )
}
