const vscode = require('vscode');

const VIEW_TYPE = 'myBrowser.browserView';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const provider = new BrowserViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VIEW_TYPE, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		vscode.commands.registerCommand('myBrowser.open', () => {
			vscode.commands.executeCommand('workbench.view.extension.myBrowser');
		})
	);
}

function deactivate() {}

class BrowserViewProvider {
	/**
	 * @param {vscode.Uri} extensionUri
	 */
	constructor(extensionUri) {
		this.extensionUri = extensionUri;
	}

	/**
	 * @param {vscode.WebviewView} webviewView
	 */
	resolveWebviewView(webviewView) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri],
		};

		webviewView.webview.html = this.getHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((message) => {
			if (message.command === 'openExternal') {
				const target = normalizeUrl(message.url);

				if (target) {
					vscode.env.openExternal(vscode.Uri.parse(target));
				}
			}
		});
	}

	/**
	 * @param {vscode.Webview} webview
	 */
	getHtml(webview) {
		const nonce = getNonce();
		const cspSource = webview.cspSource;

		return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src http: https:;">
	<title>Browser</title>
	<style>
		:root {
			color-scheme: light dark;
			--border: var(--vscode-panel-border);
			--button: var(--vscode-button-secondaryBackground);
			--button-hover: var(--vscode-button-secondaryHoverBackground);
			--foreground: var(--vscode-foreground);
			--input-background: var(--vscode-input-background);
			--input-border: var(--vscode-input-border);
			--input-foreground: var(--vscode-input-foreground);
			--muted: var(--vscode-descriptionForeground);
		}

		* {
			box-sizing: border-box;
		}

		html,
		body {
			width: 100%;
			height: 100%;
			margin: 0;
			padding: 0;
			color: var(--foreground);
			background: var(--vscode-sideBar-background);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		}

		body {
			display: grid;
			grid-template-rows: auto auto 1fr;
			min-width: 0;
			overflow: hidden;
		}

		.toolbar {
			display: grid;
			grid-template-columns: repeat(4, 28px) 1fr 32px;
			gap: 4px;
			padding: 8px;
			border-bottom: 1px solid var(--border);
		}

		button,
		input {
			height: 28px;
			border: 1px solid var(--input-border);
			border-radius: 4px;
			font: inherit;
		}

		button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			color: var(--foreground);
			background: var(--button);
			cursor: pointer;
		}

		button:hover {
			background: var(--button-hover);
		}

		button:disabled {
			opacity: 0.45;
			cursor: default;
		}

		input {
			width: 100%;
			min-width: 0;
			padding: 0 8px;
			color: var(--input-foreground);
			background: var(--input-background);
		}

		.status {
			min-height: 24px;
			padding: 4px 8px;
			color: var(--muted);
			border-bottom: 1px solid var(--border);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.frame-wrap {
			position: relative;
			min-height: 0;
			background: var(--vscode-editor-background);
		}

		iframe {
			width: 100%;
			height: 100%;
			border: 0;
			background: white;
		}

		.embed-message {
			position: absolute;
			inset: 0;
			display: none;
			flex-direction: column;
			align-items: flex-start;
			justify-content: center;
			gap: 10px;
			padding: 16px;
			color: var(--foreground);
			background: var(--vscode-editor-background);
		}

		.embed-message.visible {
			display: flex;
		}

		.message-title {
			font-weight: 600;
		}

		.message-copy {
			color: var(--muted);
			line-height: 1.4;
		}

		.message-action {
			width: auto;
			padding: 0 10px;
		}
	</style>
</head>
<body>
	<form class="toolbar" id="browserForm">
		<button type="button" id="backButton" title="Back" aria-label="Back" disabled>&larr;</button>
		<button type="button" id="forwardButton" title="Forward" aria-label="Forward" disabled>&rarr;</button>
		<button type="button" id="reloadButton" title="Reload" aria-label="Reload">&#8635;</button>
		<button type="button" id="homeButton" title="Home" aria-label="Home">&#8962;</button>
		<input id="addressInput" aria-label="Address" placeholder="Search or enter URL" spellcheck="false" autocomplete="off">
		<button type="button" id="externalButton" title="Open externally" aria-label="Open externally">&#8599;</button>
	</form>
	<div class="status" id="status">Ready</div>
	<div class="frame-wrap">
		<iframe id="browserFrame" title="Browser preview" sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"></iframe>
		<div class="embed-message" id="embedMessage">
			<div class="message-title">This site cannot be shown inside JD Browser</div>
			<div class="message-copy" id="embedMessageCopy"></div>
			<button type="button" class="message-action" id="embedExternalButton">Open externally</button>
		</div>
	</div>

	<script nonce="${nonce}">
		(() => {
			const vscode = acquireVsCodeApi();
			const homeUrl = 'http://localhost:9111';
			const form = document.getElementById('browserForm');
			const frame = document.getElementById('browserFrame');
			const input = document.getElementById('addressInput');
			const status = document.getElementById('status');
			const backButton = document.getElementById('backButton');
			const forwardButton = document.getElementById('forwardButton');
			const reloadButton = document.getElementById('reloadButton');
			const homeButton = document.getElementById('homeButton');
			const externalButton = document.getElementById('externalButton');
			const embedMessage = document.getElementById('embedMessage');
			const embedMessageCopy = document.getElementById('embedMessageCopy');
			const embedExternalButton = document.getElementById('embedExternalButton');
			const embeddedBlocklist = new Set([
				'accounts.google.com',
				'docs.google.com',
				'drive.google.com',
				'google.com',
				'mail.google.com',
				'www.google.com',
				'www.youtube.com',
				'youtube.com'
			]);

			let history = [];
			let historyIndex = -1;

			const setStatus = (value) => {
				status.textContent = value;
			};

			const getHost = (value) => {
				try {
					return new URL(value).hostname.toLowerCase();
				} catch {
					return '';
				}
			};

			const isBlockedEmbedHost = (value) => {
				const host = getHost(value);

				return embeddedBlocklist.has(host);
			};

			const showEmbedMessage = (target) => {
				embedMessageCopy.textContent = new URL(target).hostname + ' blocks embedded browsers using security headers, so JD Browser opened it in your system browser.';
				embedMessage.classList.add('visible');
			};

			const hideEmbedMessage = () => {
				embedMessage.classList.remove('visible');
			};

			const openExternal = (url = input.value) => {
				vscode.postMessage({ command: 'openExternal', url });
			};

			const normalizeUrl = (value) => {
				const raw = value.trim();

				if (!raw) {
					return homeUrl;
				}

				if (/^[a-z][a-z0-9+.-]*:\\/\\//i.test(raw)) {
					return raw;
				}

				if (raw.includes('.') && !raw.includes(' ')) {
					return 'https://' + raw;
				}

				return 'https://www.bing.com/search?q=' + encodeURIComponent(raw);
			};

			const updateButtons = () => {
				backButton.disabled = historyIndex <= 0;
				forwardButton.disabled = historyIndex >= history.length - 1;
			};

			const navigate = (value, addToHistory = true) => {
				const target = normalizeUrl(value);
				input.value = target;

				if (isBlockedEmbedHost(target)) {
					frame.removeAttribute('src');
					showEmbedMessage(target);
					openExternal(target);
					setStatus('Opened externally because this site blocks embedding: ' + target);
				} else {
					hideEmbedMessage();
					frame.src = target;
					setStatus('Loading ' + target);
				}

				if (addToHistory) {
					history = history.slice(0, historyIndex + 1);
					history.push(target);
					historyIndex = history.length - 1;
				}

				updateButtons();
			};

			form.addEventListener('submit', (event) => {
				event.preventDefault();
				navigate(input.value);
			});

			backButton.addEventListener('click', () => {
				if (historyIndex > 0) {
					historyIndex -= 1;
					navigate(history[historyIndex], false);
				}
			});

			forwardButton.addEventListener('click', () => {
				if (historyIndex < history.length - 1) {
					historyIndex += 1;
					navigate(history[historyIndex], false);
				}
			});

			reloadButton.addEventListener('click', () => {
				navigate(input.value, false);
			});

			homeButton.addEventListener('click', () => {
				navigate(homeUrl);
			});

			externalButton.addEventListener('click', () => {
				openExternal();
			});

			embedExternalButton.addEventListener('click', () => {
				openExternal();
			});

			frame.addEventListener('load', () => {
				if (!embedMessage.classList.contains('visible')) {
					setStatus('Loaded ' + input.value + '. If the page is blank, use Open externally.');
				}
			});

			navigate(homeUrl);
		})();
	</script>
</body>
</html>`;
	}
}

/**
 * @param {string} value
 */
function normalizeUrl(value) {
	if (typeof value !== 'string') {
		return undefined;
	}

	const raw = value.trim();

	if (!raw) {
		return undefined;
	}

	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
		return raw;
	}

	return `https://${raw}`;
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (let i = 0; i < 32; i += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}

module.exports = {
	activate,
	deactivate,
};
