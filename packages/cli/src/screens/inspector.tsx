import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useState } from "react";
import { formatTTL, getClient, getKeyTTL, getKeyValue } from "../lib/redis.ts";
import { theme } from "../lib/theme.ts";
import type { Connection, ExplorerState, Screen } from "../types.ts";

interface Props {
	connection: Connection;
	redisKey: string;
	explorerState: ExplorerState;
	onNavigate: (screen: Screen) => void;
}

export function InspectorScreen({
	connection,
	redisKey,
	explorerState,
	onNavigate,
}: Props) {
	const { height } = useTerminalDimensions();
	const [type, setType] = useState<string>("");
	const [value, setValue] = useState<string>("");
	const [ttl, setTtl] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [scrollOffset, setScrollOffset] = useState(0);

	const valueLines = value.split("\n");
	const visibleHeight = height - 9;
	const totalLines = (tryParseJson(value) ?? valueLines).length;

	useEffect(() => {
		let cancelled = false;
		async function load() {
			const client = getClient();
			if (!client) {
				setError("No active connection");
				setLoading(false);
				return;
			}
			try {
				const [kv, keyTtl] = await Promise.all([
					getKeyValue(client, redisKey),
					getKeyTTL(client, redisKey),
				]);
				if (!cancelled) {
					setType(kv.type);
					setValue(kv.value);
					setTtl(formatTTL(keyTtl));
					setLoading(false);
				}
			} catch (e: unknown) {
				if (!cancelled) {
					setError((e as Error).message ?? "Failed to read key");
					setLoading(false);
				}
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [redisKey]);

	useKeyboard((key) => {
		if (
			key.name === "q" ||
			key.name === "escape" ||
			key.name === "h" ||
			key.name === "left"
		) {
			onNavigate({ type: "explorer", connection, restoreState: explorerState });
			return;
		}
		if (key.name === "j" || key.name === "down") {
			setScrollOffset((o: number) =>
				Math.min(o + 1, Math.max(0, totalLines - visibleHeight)),
			);
		} else if (key.name === "k" || key.name === "up") {
			setScrollOffset((o: number) => Math.max(o - 1, 0));
		} else if (key.name === "g" && !key.shift) {
			setScrollOffset(0);
		} else if (key.name === "g" && key.shift) {
			setScrollOffset(Math.max(0, totalLines - visibleHeight));
		}
	});

	if (loading) {
		return (
			<box flexDirection="column" width="100%" height="100%" padding={1}>
				<text fg={theme.accent}>Loading {redisKey}...</text>
			</box>
		);
	}

	if (error) {
		return (
			<box flexDirection="column" width="100%" height="100%" padding={1}>
				<text fg={theme.error}>{error}</text>
				<text>{""}</text>
				<text fg={theme.textDim}>Press q to return.</text>
			</box>
		);
	}

	return (
		<box flexDirection="column" width="100%" height="100%">
			<box flexDirection="column" padding={1} flexGrow={1}>
				<text fg={theme.accent}>
					{"  "}
					{redisKey}
				</text>
				<text>{""}</text>
				<box flexDirection="row" gap={4} height={1} paddingX={2}>
					<text fg={theme.textDim}>
						Type: <span fg={theme.info}>{type}</span>
					</text>
					<text fg={theme.textDim}>
						TTL: <span fg={theme.warning}>{ttl}</span>
					</text>
				</box>
				<text>{""}</text>
				<text fg={theme.textDim}>
					{"  "}
					{"─".repeat(40)}
				</text>
				<text>{""}</text>

				{(() => {
					const lines = tryParseJson(value) ?? valueLines;
					const visible = lines.slice(
						scrollOffset,
						scrollOffset + visibleHeight,
					);
					return visible.map((line: string, i: number) => (
						<text key={`line-${scrollOffset}-${i}`} fg={theme.textSecondary}>
							{"  "}
							{line}
						</text>
					));
				})()}
			</box>

			<box
				width="100%"
				height={1}
				backgroundColor={theme.bg}
				flexDirection="row"
				paddingX={1}
			>
				<text fg={theme.textDim}>
					<span fg={theme.accent}>j</span>/<span fg={theme.accent}>k</span>{" "}
					Scroll{"  "}
					<span fg={theme.accent}>q</span> Back
					{totalLines > visibleHeight && (
						<span fg={theme.textDim}>
							{"  "}[{scrollOffset + 1}-
							{Math.min(scrollOffset + visibleHeight, totalLines)}/{totalLines}]
						</span>
					)}
				</text>
			</box>
		</box>
	);
}

function tryParseJson(value: string): string[] | null {
	try {
		const parsed = JSON.parse(value);
		return JSON.stringify(parsed, null, 2).split("\n");
	} catch {
		return null;
	}
}
