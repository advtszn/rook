import { useKeyboard } from "@opentui/react"

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
          borderColor: "#f7768e",
        }}
        padding={1}
        backgroundColor="#1a1b26"
        gap={1}
      >
        <text fg="#f7768e">{message}</text>
        {detail && <text fg="#565f89">{detail}</text>}
        <text>{""}</text>
        <text fg="#565f89">
          <span fg="#f7768e">y</span> Confirm{"  "}
          <span fg="#7aa2f7">n</span> Cancel
        </text>
      </box>
    </box>
  )
}
