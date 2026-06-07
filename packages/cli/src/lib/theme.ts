const palette = {
	bg: "#000000",
	bgDark: "#000000",
	bgHighlight: "#1a1a1a",
	border: "#262626",
	borderActive: "#454545",
	text: "#EDEDED",
	muted: "#878787",
	primary: "#0070F3",
	info: "#52A8FF",
	purple: "#BF7AF0",
	green: "#63C46D",
	yellow: "#F2A700",
	red: "#E5484D",
} as const;

export const theme = {
	bg: palette.bg,
	bgDark: palette.bgDark,
	bgHighlight: palette.bgHighlight,

	border: palette.border,
	borderActive: palette.borderActive,

	text: palette.text,
	textSecondary: palette.text,
	textMuted: palette.muted,
	textDim: palette.muted,

	accent: palette.info,
	error: palette.red,
	warning: palette.yellow,
	success: palette.green,
	info: palette.purple,
} as const;
