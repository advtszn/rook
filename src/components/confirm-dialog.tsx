import { useKeyboard } from "@opentui/react"
import { theme } from "../lib/theme.ts"

interface Props {
  message: string
  detail?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ message, detail, onConfirm, onCancel }: Props) {
  useKeyboard((key) => {
    if (key.name === "y") {
      onConfirm()
    } else if (key.name === "n" || key.name === "escape") {
      onCancel()
    }
  })

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      <box
        flexDirection="column"
        width={50}
        style={{
          borderStyle: "rounded",
          borderColor: theme.error,
        }}
        padding={1}
        backgroundColor={theme.bg}
        gap={1}
      >
        <text fg={theme.error}>{message}</text>
        {detail && <text fg={theme.textDim}>{detail}</text>}
        <text>{""}</text>
        <text fg={theme.textDim}>
          <span fg={theme.error}>y</span> Confirm{"  "}
          <span fg={theme.accent}>n</span> Cancel
        </text>
      </box>
    </box>
  )
}
