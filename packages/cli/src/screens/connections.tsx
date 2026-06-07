import {
	useKeyboard,
	useRenderer,
	useTerminalDimensions,
} from "@opentui/react";
import { useCallback, useState } from "react";
import { AddConnectionModal } from "../components/add-connection-modal.tsx";
import { ConfirmDialog } from "../components/confirm-dialog.tsx";
import {
	loadConfig,
	deleteConnection as removeConnection,
} from "../lib/config.ts";
import { theme } from "../lib/theme.ts";
import type { Connection, Screen } from "../types.ts";

interface Props {
	onNavigate: (screen: Screen) => void;
}

export function ConnectionsScreen({ onNavigate }: Props) {
	const renderer = useRenderer();
	useTerminalDimensions();
	const [connections, setConnections] = useState<Connection[]>(
		() => loadConfig().connections,
	);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showInfo, setShowInfo] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refreshConnections = useCallback(() => {
		setConnections(loadConfig().connections);
	}, []);

	useKeyboard((key) => {
		if (showAddModal || showDeleteConfirm || showInfo) return;

		if (key.name === "q") {
			renderer.destroy();
			return;
		}

		if (key.name === "j" || key.name === "down") {
			setSelectedIndex((i: number) => Math.min(i + 1, connections.length - 1));
		} else if (key.name === "k" || key.name === "up") {
			setSelectedIndex((i: number) => Math.max(i - 1, 0));
		} else if (key.name === "return") {
			if (connections.length > 0 && connections[selectedIndex]) {
				setError(null);
				onNavigate({
					type: "explorer",
					connection: connections[selectedIndex],
				});
			}
		} else if (key.name === "a") {
			setShowAddModal(true);
		} else if (key.name === "d" && key.shift) {
			if (connections.length > 0 && connections[selectedIndex]) {
				setShowDeleteConfirm(true);
			}
		} else if (key.name === "i") {
			if (connections.length > 0 && connections[selectedIndex]) {
				setShowInfo(true);
			}
		} else if (key.name === "g" && !key.shift) {
			setSelectedIndex(0);
		} else if (key.name === "g" && key.shift) {
			setSelectedIndex(Math.max(0, connections.length - 1));
		}
	});

	const handleSave = useCallback(() => {
		refreshConnections();
		setShowAddModal(false);
	}, [refreshConnections]);

	const handleCancel = useCallback(() => {
		setShowAddModal(false);
	}, []);

	const handleDeleteConfirm = useCallback(() => {
		const conn = connections[selectedIndex];
		if (conn) {
			removeConnection(conn.name);
			refreshConnections();
			setSelectedIndex((i: number) =>
				Math.max(0, Math.min(i, connections.length - 2)),
			);
		}
		setShowDeleteConfirm(false);
	}, [connections, selectedIndex, refreshConnections]);

	const handleDeleteCancel = useCallback(() => {
		setShowDeleteConfirm(false);
	}, []);

	return (
		<box flexDirection="column" width="100%" height="100%">
			<box flexDirection="column" padding={1} flexGrow={1}>
				<text fg={theme.accent}>{"  "}ROOK</text>
				<text>{""}</text>
				<text fg={theme.textDim}>{"  "}Connections</text>
				<text>{""}</text>

				{connections.length === 0 ? (
					<text fg={theme.textDim}>
						{"  "}No connections saved. Press 'a' to add one.
					</text>
				) : (
					connections.map((conn: Connection, i: number) => (
						<text
							key={conn.name}
							fg={i === selectedIndex ? theme.text : theme.textDim}
							bg={i === selectedIndex ? theme.bgHighlight : undefined}
						>
							{"  "}
							{i === selectedIndex ? "› " : "  "}
							{conn.name}
							<span fg={theme.textDim}>
								{" "}
								({conn.host}:{conn.port}/{conn.database})
							</span>
						</text>
					))
				)}

				{error && (
					<box marginTop={1}>
						<text fg={theme.error}>
							{"  "}
							{error}
						</text>
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
					<span fg={theme.accent}>i</span> Info{"  "}
					<span fg={theme.accent}>D</span> Delete{"  "}
					<span fg={theme.accent}>Enter</span> Connect{"  "}
					<span fg={theme.accent}>q</span> Quit
				</text>
			</box>

			{showAddModal && (
				<AddConnectionModal onSave={handleSave} onCancel={handleCancel} />
			)}

			{showInfo && connections[selectedIndex] && (
				<box
					position="absolute"
					left={0}
					top={0}
					width="100%"
					height="100%"
					justifyContent="center"
					alignItems="center"
				>
					<ConnectionInfo
						connection={connections[selectedIndex]}
						onClose={() => setShowInfo(false)}
					/>
				</box>
			)}

			{showDeleteConfirm && connections[selectedIndex] && (
				<ConfirmDialog
					message={`Delete connection "${connections[selectedIndex].name}"?`}
					onConfirm={handleDeleteConfirm}
					onCancel={handleDeleteCancel}
				/>
			)}
		</box>
	);
}

function ConnectionInfo({
	connection,
	onClose,
}: {
	connection: Connection;
	onClose: () => void;
}) {
	useKeyboard((key) => {
		if (key.name === "escape" || key.name === "i" || key.name === "q") {
			onClose();
		}
	});

	return (
		<box
			flexDirection="column"
			width={50}
			style={{ borderStyle: "rounded", borderColor: theme.accent }}
			padding={1}
			backgroundColor={theme.bg}
			gap={1}
		>
			<text fg={theme.accent}>{connection.name}</text>
			<text>{""}</text>
			<box flexDirection="row" height={1}>
				<text fg={theme.textDim}>Host{"      "}</text>
				<text fg={theme.text}>{connection.host}</text>
			</box>
			<box flexDirection="row" height={1}>
				<text fg={theme.textDim}>Port{"      "}</text>
				<text fg={theme.text}>{connection.port}</text>
			</box>
			<box flexDirection="row" height={1}>
				<text fg={theme.textDim}>Username{"  "}</text>
				<text fg={theme.text}>{connection.username || "default"}</text>
			</box>
			<box flexDirection="row" height={1}>
				<text fg={theme.textDim}>Password{"  "}</text>
				<text fg={theme.text}>{connection.password ? "••••••••" : "none"}</text>
			</box>
			<box flexDirection="row" height={1}>
				<text fg={theme.textDim}>Database{"  "}</text>
				<text fg={theme.text}>{connection.database}</text>
			</box>
			<box flexDirection="row" height={1}>
				<text fg={theme.textDim}>TLS{"       "}</text>
				<text fg={connection.tls ? theme.success : theme.textMuted}>
					{connection.tls ? "Enabled" : "Disabled"}
				</text>
			</box>
			{connection.autoRefreshInterval && (
				<box flexDirection="row" height={1}>
					<text fg={theme.textDim}>Auto-Ref{"  "}</text>
					<text fg={theme.warning}>{connection.autoRefreshInterval}s</text>
				</box>
			)}
			<text>{""}</text>
			<text fg={theme.textDim}>
				<span fg={theme.accent}>Esc</span> Close
			</text>
		</box>
	);
}
