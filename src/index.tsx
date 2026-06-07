import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useState, useCallback } from "react"
import type { Screen } from "./types.ts"
import { ConnectionsScreen } from "./screens/connections.tsx"
import { ExplorerScreen } from "./screens/explorer.tsx"
import { InspectorScreen } from "./screens/inspector.tsx"

function App() {
  const [screen, setScreen] = useState<Screen>({ type: "connections" })

  const handleNavigate = useCallback((next: Screen) => {
    setScreen(next)
  }, [])

  switch (screen.type) {
    case "connections":
      return <ConnectionsScreen onNavigate={handleNavigate} />
    case "explorer":
      return (
        <ExplorerScreen
          connection={screen.connection}
          restoreState={screen.restoreState}
          onNavigate={handleNavigate}
        />
      )
    case "inspector":
      return (
        <InspectorScreen
          connection={screen.connection}
          redisKey={screen.redisKey}
          explorerState={screen.explorerState}
          onNavigate={handleNavigate}
        />
      )
  }
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
})
createRoot(renderer).render(<App />)
