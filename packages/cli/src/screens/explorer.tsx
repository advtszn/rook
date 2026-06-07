import {
	useKeyboard,
	useRenderer,
	useTerminalDimensions,
} from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../components/confirm-dialog.tsx";
import { updateConnection } from "../lib/config.ts";
import {
	connectToRedis,
	deleteKey,
	deleteNamespace,
	disconnectRedis,
	formatTTL,
	getClient,
	getKeyTTL,
	getKeyValue,
	scanKeys,
} from "../lib/redis.ts";
import { theme } from "../lib/theme.ts";
import { buildTree, filterTree, getNodesAtPath } from "../lib/tree.ts";
import type { Connection, ExplorerState, Screen, TreeNode } from "../types.ts";

interface Props {
	connection: Connection;
	restoreState?: ExplorerState;
	onNavigate: (screen: Screen) => void;
}

function clamp(val: number, min: number, max: number) {
	return Math.max(min, Math.min(max, val));
}

function scrollForIndex(
	selected: number,
	viewHeight: number,
	currentScroll: number,
): number {
	if (selected < 0) return 0;
	if (selected < currentScroll) return selected;
	if (selected >= currentScroll + viewHeight) return selected - viewHeight + 1;
	return Math.max(0, currentScroll);
}

interface Preview {
	type: string;
	value: string;
	ttl: string;
}

export function ExplorerScreen({
	connection,
	restoreState,
	onNavigate,
}: Props) {
	const renderer = useRenderer();
	const { width, height } = useTerminalDimensions();
	const [tree, setTree] = useState<TreeNode[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchMode, setSearchMode] = useState(false);

	const [path, setPath] = useState<number[]>(restoreState?.path ?? []);
	const [selectedIndex, setSelectedIndex] = useState(
		restoreState?.selectedIndex ?? 0,
	);
	// remember selected index per path so going back restores position
	const selectedCache = useRef<Map<string, number>>(new Map());
	// scroll offsets per column
	const [leftScroll, setLeftScroll] = useState(0);
	const [midScroll, setMidScroll] = useState(0);
	const [rightScroll, setRightScroll] = useState(0);
	// delete confirmation
	const [confirmDelete, setConfirmDelete] = useState<{
		key: string;
		isNamespace: boolean;
	} | null>(null);
	// preview for leaf nodes
	const [preview, setPreview] = useState<Preview | null>(null);
	const [previewKey, setPreviewKey] = useState<string | null>(null);
	// auto-refresh
	const AUTO_REFRESH_INTERVALS = [5, 10, 30] as const;
	const savedInterval = connection.autoRefreshInterval;
	const initialIndex = savedInterval
		? AUTO_REFRESH_INTERVALS.indexOf(savedInterval as 5 | 10 | 30)
		: -1;
	const [autoRefreshIndex, setAutoRefreshIndex] =
		useState<number>(initialIndex);
	const autoRefreshInterval =
		autoRefreshIndex >= 0
			? (AUTO_REFRESH_INTERVALS[autoRefreshIndex] as number)
			: null;
	const [copied, setCopied] = useState(false);

	const colHeight = height - 5;

	const displayTree = searchQuery ? filterTree(tree, searchQuery) : tree;

	// Derive columns from path
	const { parent: parentNodes, current: currentNodes } = getNodesAtPath(
		displayTree,
		path,
	);
	const parentIndex = path.length > 0 ? (path[path.length - 1] as number) : -1;

	const safeSelected =
		currentNodes.length > 0
			? clamp(selectedIndex, 0, currentNodes.length - 1)
			: -1;
	const selectedNode =
		safeSelected >= 0 ? (currentNodes[safeSelected] ?? null) : null;
	const rightNodes = selectedNode ? selectedNode.children : [];

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on fullKey only to avoid re-fetching on every render
	useEffect(() => {
		if (!selectedNode || selectedNode.children.length > 0) {
			setPreview(null);
			setPreviewKey(null);
			return;
		}
		if (selectedNode.fullKey === previewKey) return;

		let cancelled = false;
		const client = getClient();
		if (!client) return;

		setPreviewKey(selectedNode.fullKey);
		getKeyValue(client, selectedNode.fullKey)
			.then(async (kv) => {
				if (cancelled) return;
				const ttl = await getKeyTTL(client, selectedNode.fullKey);
				setPreview({ type: kv.type, value: kv.value, ttl: formatTTL(ttl) });
			})
			.catch(() => {
				if (!cancelled) setPreview(null);
			});
		return () => {
			cancelled = true;
		};
	}, [selectedNode?.fullKey]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on serialized path
	useEffect(() => {
		setMidScroll(0);
	}, [path.join(",")]);

	useEffect(() => {
		setMidScroll((s: number) => scrollForIndex(safeSelected, colHeight, s));
	}, [safeSelected, colHeight]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on key change only
	useEffect(() => {
		setRightScroll(0);
	}, [selectedNode?.fullKey]);

	// Keep left scroll in sync with parent highlight
	useEffect(() => {
		if (parentIndex >= 0) {
			setLeftScroll((s: number) => scrollForIndex(parentIndex, colHeight, s));
		}
	}, [parentIndex, colHeight]);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const client = connectToRedis(connection);
				await client.connect();
				const keys = await scanKeys(client);
				if (!cancelled) {
					setTree(buildTree(keys));
					setLoading(false);
				}
			} catch (e: unknown) {
				if (!cancelled) {
					const err = e as Record<string, string>;
					setError(`${err.message ?? "Connection failed"} [${err.code ?? ""}]`);
					setLoading(false);
				}
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, [connection]);

	const navigateRight = useCallback(() => {
		if (safeSelected < 0 || !selectedNode) return;
		if (selectedNode.children.length > 0) {
			selectedCache.current.set(path.join(","), safeSelected);
			setPath((p: number[]) => [...p, safeSelected]);
			const cachedIdx = selectedCache.current.get(
				[...path, safeSelected].join(","),
			);
			setSelectedIndex(cachedIdx ?? 0);
		} else if (selectedNode.isLeaf) {
			onNavigate({
				type: "inspector",
				connection,
				redisKey: selectedNode.fullKey,
				explorerState: { path, selectedIndex: safeSelected },
			});
		}
	}, [safeSelected, selectedNode, path, connection, onNavigate]);

	const refreshTree = useCallback(async () => {
		const client = getClient();
		if (!client) return;
		const keys = await scanKeys(client);
		setTree(buildTree(keys));
	}, []);

	// Auto-refresh polling
	useEffect(() => {
		if (autoRefreshInterval === null) return;
		const id = setInterval(() => {
			refreshTree();
		}, autoRefreshInterval * 1000);
		return () => clearInterval(id);
	}, [autoRefreshInterval, refreshTree]);

	useEffect(() => {
		if (!copied) return;
		const id = setTimeout(() => setCopied(false), 1500);
		return () => clearTimeout(id);
	}, [copied]);

	const handleDeleteConfirm = useCallback(async () => {
		const client = getClient();
		if (!client || !confirmDelete) return;
		if (confirmDelete.isNamespace) {
			await deleteNamespace(client, confirmDelete.key);
		} else {
			await deleteKey(client, confirmDelete.key);
		}
		setConfirmDelete(null);
		await refreshTree();
		setSelectedIndex((i: number) =>
			clamp(i, 0, Math.max(0, currentNodes.length - 2)),
		);
	}, [confirmDelete, currentNodes.length, refreshTree]);

	const navigateLeft = useCallback(() => {
		if (path.length === 0) return;
		const prevIdx = path[path.length - 1] as number;
		setPath((p: number[]) => p.slice(0, -1));
		setSelectedIndex(prevIdx);
	}, [path]);

	useKeyboard((key) => {
		if (confirmDelete) return;

		if (searchMode) {
			if (key.name === "escape") {
				setSearchMode(false);
				setSearchQuery("");
				return;
			}
			if (key.name === "return") {
				setSearchMode(false);
				return;
			}
			if (key.name === "backspace" && (key.meta || key.option)) {
				setSearchQuery((q: string) => {
					const trimmed = q.trimEnd();
					const lastSpace = trimmed.lastIndexOf(" ");
					return lastSpace >= 0 ? q.slice(0, lastSpace) : "";
				});
				setSelectedIndex(0);
				setPath([]);
				return;
			}
			if (key.name === "backspace" && key.ctrl) {
				setSearchQuery("");
				setSelectedIndex(0);
				setPath([]);
				return;
			}
			if (key.name === "backspace") {
				setSearchQuery((q: string) => q.slice(0, -1));
				setSelectedIndex(0);
				setPath([]);
				return;
			}
			if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
				setSearchQuery((q: string) => q + key.sequence);
				setSelectedIndex(0);
				setPath([]);
				return;
			}
			return;
		}

		if (key.name === "q" || key.name === "escape") {
			disconnectRedis();
			onNavigate({ type: "connections" });
			return;
		}

		if (key.name === "j" || key.name === "down") {
			setSelectedIndex((i: number) => clamp(i + 1, 0, currentNodes.length - 1));
		} else if (key.name === "k" || key.name === "up") {
			setSelectedIndex((i: number) => clamp(i - 1, 0, currentNodes.length - 1));
		} else if (
			key.name === "l" ||
			key.name === "right" ||
			key.name === "return"
		) {
			navigateRight();
		} else if (key.name === "h" || key.name === "left") {
			navigateLeft();
		} else if (key.name === "g" && !key.shift) {
			setSelectedIndex(0);
		} else if (key.name === "g" && key.shift) {
			setSelectedIndex(Math.max(0, currentNodes.length - 1));
		} else if (key.sequence === "/") {
			setSearchMode(true);
			setSearchQuery("");
			setPath([]);
			setSelectedIndex(0);
		} else if (key.name === "r" && !key.shift) {
			refreshTree();
		} else if (key.name === "r" && key.shift) {
			setAutoRefreshIndex((i: number) => {
				const next = i + 1 >= AUTO_REFRESH_INTERVALS.length ? -1 : i + 1;
				const interval =
					next >= 0 ? (AUTO_REFRESH_INTERVALS[next] as number) : null;
				updateConnection(connection.name, { autoRefreshInterval: interval });
				return next;
			});
		} else if (key.name === "y" && !key.shift) {
			if (selectedNode) {
				renderer.copyToClipboardOSC52(selectedNode.fullKey);
				setCopied(true);
			}
		} else if (key.name === "d" && key.shift) {
			if (selectedNode) {
				const isNamespace =
					selectedNode.children.length > 0 && !selectedNode.isLeaf;
				setConfirmDelete({ key: selectedNode.fullKey, isNamespace });
			}
		}
	});

	if (error) {
		return (
			<box flexDirection="column" width="100%" height="100%" padding={1}>
				<text fg={theme.error}>Unable to connect</text>
				<text>{""}</text>
				<text fg={theme.textDim}>Host: {connection.host}</text>
				<text fg={theme.textDim}>Port: {connection.port}</text>
				<text fg={theme.textDim}>TLS: {connection.tls ? "on" : "off"}</text>
				<text>{""}</text>
				<text fg={theme.textDim}>{error}</text>
				<text>{""}</text>
				<text fg={theme.textDim}>Press q to go back.</text>
			</box>
		);
	}

	if (loading) {
		return (
			<box flexDirection="column" width="100%" height="100%" padding={1}>
				<text fg={theme.accent}>Connecting to {connection.name}...</text>
			</box>
		);
	}

	const atRoot = path.length === 0;
	const colWidth = atRoot
		? Math.floor((width - 2) / 2)
		: Math.floor((width - 2) / 3);

	// Build the path string
	const pathParts: string[] = [];
	let walkNodes = displayTree;
	for (const idx of path) {
		const node = walkNodes[idx];
		if (!node) break;
		pathParts.push(node.key);
		walkNodes = node.children;
	}
	if (selectedNode) pathParts.push(selectedNode.key);
	const pathStr = `${connection.name}:${pathParts.join("/")}`;

	return (
		<box flexDirection="column" width="100%" height="100%">
			{/* Header */}
			<box
				height={1}
				paddingX={1}
				flexDirection="row"
				justifyContent="space-between"
			>
				<text fg={theme.accent}>
					{connection.name}{" "}
					<span fg={theme.textDim}>
						({connection.host}:{connection.port}/{connection.database})
					</span>
				</text>
				{autoRefreshInterval !== null && (
					<text fg={theme.warning}>
						{"  "}⚠ Auto-refresh enabled — may increase Redis read overhead
					</text>
				)}
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
						borderColor={theme.border}
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
					borderColor={theme.borderActive}
				/>

				{/* Right column: preview */}
				{preview && selectedNode && selectedNode.children.length === 0 ? (
					<ValuePreview
						preview={preview}
						width={colWidth}
						maxItems={colHeight}
						scrollOffset={rightScroll}
						borderColor={theme.border}
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
						borderColor={theme.border}
					/>
				)}
			</box>

			{/* Status bar */}
			<box
				width="100%"
				height={1}
				flexDirection="row"
				justifyContent="space-between"
				backgroundColor={theme.bg}
				paddingX={1}
			>
				{searchMode ? (
					<text fg={theme.text}>/{searchQuery}▎</text>
				) : (
					<text fg={theme.textDim}>
						{searchQuery && (
							<span fg={theme.textMuted}>
								/{searchQuery}
								{"  "}
							</span>
						)}
						{autoRefreshInterval !== null && (
							<span fg={theme.warning}>
								↻ {autoRefreshInterval}s{"  "}
							</span>
						)}
						<span fg={theme.accent}>h</span>/<span fg={theme.accent}>l</span>{" "}
						Navigate
						{"  "}
						<span fg={theme.accent}>j</span>/<span fg={theme.accent}>k</span>{" "}
						Select{"  "}
						<span fg={theme.accent}>/</span> Search{"  "}
						<span fg={theme.accent}>r</span> Refresh{"  "}
						<span fg={theme.accent}>R</span> Auto Refresh{"  "}
						<span fg={theme.accent}>y</span> Copy{"  "}
						<span fg={theme.accent}>D</span> Delete{"  "}
						<span fg={theme.accent}>q</span> Back
					</text>
				)}

				{/* Path bar */}
				<box height={1} backgroundColor={theme.bg} paddingX={1}>
					<text fg={theme.textDim}>{pathStr}</text>
				</box>
			</box>

			{copied && (
				<box position="absolute" top={0} right={2} padding={1}>
					<box
						width={24}
						height={3}
						backgroundColor={theme.bg}
						style={{ borderStyle: "rounded", borderColor: theme.success }}
						justifyContent="center"
						alignItems="center"
					>
						<text fg={theme.success}>Copied to clipboard</text>
					</box>
				</box>
			)}

			{confirmDelete && (
				<ConfirmDialog
					message={
						confirmDelete.isNamespace
							? `Delete all keys under "${confirmDelete.key}:*"?`
							: `Delete key "${confirmDelete.key}"?`
					}
					detail={
						confirmDelete.isNamespace
							? "This will delete all keys in this namespace."
							: undefined
					}
					onConfirm={handleDeleteConfirm}
					onCancel={() => setConfirmDelete(null)}
				/>
			)}
		</box>
	);
}

interface ColumnProps {
	nodes: TreeNode[];
	highlightIndex: number;
	selectedIndex: number;
	width: number;
	maxItems: number;
	scrollOffset: number;
	dimmed: boolean;
	borderColor: string;
}

function Column({
	nodes,
	highlightIndex,
	selectedIndex,
	width,
	maxItems,
	scrollOffset,
	dimmed,
	borderColor,
}: ColumnProps) {
	const visible = nodes.slice(scrollOffset, scrollOffset + maxItems);

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
				<text fg={theme.borderActive}>{"  "}(empty)</text>
			) : (
				visible.map((node: TreeNode, vi: number) => {
					const actualIdx = scrollOffset + vi;
					const isSelected = actualIdx === selectedIndex;
					const isHighlighted = actualIdx === highlightIndex;
					const hasChildren = node.children.length > 0;
					const suffix = hasChildren ? "/" : "";

					let fg: string = dimmed ? theme.textDim : theme.textMuted;
					let bg: string | undefined;
					if (isSelected) {
						fg = theme.text;
						bg = theme.bgHighlight;
					} else if (isHighlighted) {
						fg = theme.accent;
						bg = theme.bgDark;
					}

					return (
						<text key={`${node.fullKey}-${actualIdx}`} fg={fg} bg={bg}>
							{isSelected ? " › " : "   "}
							{node.key}
							{suffix}
						</text>
					);
				})
			)}
		</box>
	);
}

interface ValuePreviewProps {
	preview: Preview;
	width: number;
	maxItems: number;
	scrollOffset: number;
	borderColor: string;
}

function ValuePreview({
	preview,
	width,
	maxItems,
	scrollOffset,
	borderColor,
}: ValuePreviewProps) {
	const lines = preview.value.split("\n");
	const headerCount = 3;
	const allLines = lines;
	const visible = allLines.slice(
		Math.max(0, scrollOffset - headerCount),
		Math.max(0, scrollOffset - headerCount) + maxItems,
	);

	return (
		<box
			width={width}
			flexGrow={1}
			style={{ borderStyle: "single", borderColor }}
			flexDirection="column"
		>
			{scrollOffset < headerCount && (
				<>
					{scrollOffset <= 0 && (
						<text fg={theme.textDim}>
							{"  "}Type: <span fg={theme.info}>{preview.type}</span>
						</text>
					)}
					{scrollOffset <= 1 && (
						<text fg={theme.textDim}>
							{"  "}TTL:{"  "}
							<span fg={theme.warning}>{preview.ttl}</span>
						</text>
					)}
					{scrollOffset <= 2 && <text>{""}</text>}
				</>
			)}
			{visible.map((line: string, i: number) => {
				return (
					<text key={`pv-${i}`} fg={theme.textMuted}>
						{"  "}
						{line}
					</text>
				);
			})}
		</box>
	);
}
