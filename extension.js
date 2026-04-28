const vscode = require('vscode');

const VIEW_TYPE = 'myBrowser.browserView';
const STATE_KEY = 'jdBrowser.state.v1';

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const provider = new BrowserViewProvider(context);

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
	 * @param {vscode.ExtensionContext} context
	 */
	constructor(context) {
		this.context = context;
		this.extensionUri = context.extensionUri;
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
			} else if (message.command === 'saveState') {
				this.context.globalState.update(STATE_KEY, message.state);
			} else if (message.command === 'requestState') {
				const state = this.context.globalState.get(STATE_KEY) || null;
				webviewView.webview.postMessage({ command: 'restoreState', state });
			} else if (message.command === 'readClipboard') {
				vscode.env.clipboard.readText().then((text) => {
					webviewView.webview.postMessage({ command: 'clipboardText', text });
				});
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
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src http: https: data:; img-src ${cspSource} https: data:;">
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
			--tab-active-bg: var(--vscode-tab-activeBackground, var(--vscode-editor-background));
			--tab-inactive-bg: var(--vscode-tab-inactiveBackground, var(--vscode-sideBar-background));
			--tab-active-fg: var(--vscode-tab-activeForeground, var(--foreground));
			--tab-inactive-fg: var(--vscode-tab-inactiveForeground, var(--muted));
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
			grid-template-rows: auto auto auto 1fr;
			min-width: 0;
			overflow: hidden;
		}

		.tabbar {
			display: flex;
			align-items: stretch;
			gap: 2px;
			padding: 4px 4px 0 4px;
			border-bottom: 1px solid var(--border);
			overflow-x: auto;
			scrollbar-width: thin;
		}

		.tabs {
			display: flex;
			gap: 2px;
			flex: 1;
			min-width: 0;
		}

		.tab {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			padding: 4px 6px 4px 10px;
			border: 1px solid var(--border);
			border-bottom: none;
			border-top-left-radius: 4px;
			border-top-right-radius: 4px;
			background: var(--tab-inactive-bg);
			color: var(--tab-inactive-fg);
			cursor: pointer;
			max-width: 200px;
			min-width: 80px;
			font-size: 12px;
		}

		.tab.active {
			background: var(--tab-active-bg);
			color: var(--tab-active-fg);
		}

		.tab-title {
			flex: 1;
			min-width: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.tab-close {
			width: 18px;
			height: 18px;
			border: none;
			background: transparent;
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			font-size: 14px;
			line-height: 1;
			padding: 0;
		}

		.tab-close:hover {
			background: var(--button-hover);
		}

		.new-tab {
			width: 28px;
			height: 28px;
			margin-left: 4px;
			border: 1px solid var(--input-border);
			background: var(--button);
			color: var(--foreground);
			border-radius: 4px;
			cursor: pointer;
			font-size: 16px;
			line-height: 1;
			align-self: center;
		}

		.new-tab:hover {
			background: var(--button-hover);
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

		.toolbar button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			color: var(--foreground);
			background: var(--button);
			cursor: pointer;
		}

		.toolbar button:hover {
			background: var(--button-hover);
		}

		.toolbar button:disabled {
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

		.frames {
			position: relative;
			min-height: 0;
			background: var(--vscode-editor-background);
		}

		.frame-wrap {
			position: absolute;
			inset: 0;
		}

		.frame-wrap[hidden] {
			display: none !important;
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
			height: 28px;
			padding: 0 10px;
			border: 1px solid var(--input-border);
			border-radius: 4px;
			background: var(--button);
			color: var(--foreground);
			cursor: pointer;
		}

		.message-action:hover {
			background: var(--button-hover);
		}
	</style>
</head>
<body>
	<div class="tabbar">
		<div class="tabs" id="tabs"></div>
		<button type="button" class="new-tab" id="newTabButton" title="New tab" aria-label="New tab">+</button>
	</div>
	<form class="toolbar" id="browserForm">
		<button type="button" id="backButton" title="Back" aria-label="Back" disabled>&larr;</button>
		<button type="button" id="forwardButton" title="Forward" aria-label="Forward" disabled>&rarr;</button>
		<button type="button" id="reloadButton" title="Reload" aria-label="Reload">&#8635;</button>
		<button type="button" id="homeButton" title="Home" aria-label="Home">&#8962;</button>
		<input id="addressInput" aria-label="Address" placeholder="Search or enter URL" spellcheck="false" autocomplete="off">
		<button type="button" id="externalButton" title="Open externally" aria-label="Open externally">&#8599;</button>
	</form>
	<div class="status" id="status">Ready</div>
	<div class="frames" id="frames"></div>

	<script nonce="${nonce}">
		(() => {
			const vscode = acquireVsCodeApi();
			const homeUrl = 'http://localhost:9111';
			const tabsEl = document.getElementById('tabs');
			const framesEl = document.getElementById('frames');
			const newTabButton = document.getElementById('newTabButton');
			const form = document.getElementById('browserForm');
			const input = document.getElementById('addressInput');
			const status = document.getElementById('status');
			const backButton = document.getElementById('backButton');
			const forwardButton = document.getElementById('forwardButton');
			const reloadButton = document.getElementById('reloadButton');
			const homeButton = document.getElementById('homeButton');
			const externalButton = document.getElementById('externalButton');
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

			let state = { tabs: [], activeId: null };
			let restored = false;

			const setStatus = (value) => {
				status.textContent = value;
			};

			const uid = () => 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

			const getHost = (value) => {
				try {
					return new URL(value).hostname.toLowerCase();
				} catch {
					return '';
				}
			};

			const isBlockedEmbedHost = (value) => embeddedBlocklist.has(getHost(value));

			const normalizeUrl = (value) => {
				const raw = (value || '').trim();
				if (!raw) return homeUrl;
				if (/^[a-z][a-z0-9+.-]*:\\/\\//i.test(raw)) return raw;
				if (raw.includes('.') && !raw.includes(' ')) return 'https://' + raw;
				return 'https://www.bing.com/search?q=' + encodeURIComponent(raw);
			};

			const titleFromUrl = (url) => {
				try {
					const u = new URL(url);
					if (u.hostname) return u.hostname + (u.pathname && u.pathname !== '/' ? u.pathname : '');
					return url;
				} catch {
					return url;
				}
			};

			const persist = () => {
				vscode.postMessage({ command: 'saveState', state });
			};

			const openExternal = (url) => {
				vscode.postMessage({ command: 'openExternal', url });
			};

			const getActiveTab = () => state.tabs.find((t) => t.id === state.activeId);

			const findWrap = (tabId) => framesEl.querySelector('.frame-wrap[data-tab-id="' + tabId + '"]');

			const createFrameWrap = (tab) => {
				const wrap = document.createElement('div');
				wrap.className = 'frame-wrap';
				wrap.dataset.tabId = tab.id;

				const iframe = document.createElement('iframe');
				iframe.title = 'Browser preview';
				iframe.setAttribute('sandbox', 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-downloads');
				iframe.setAttribute('allow', 'clipboard-read *; clipboard-write *; fullscreen *');
				iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
				iframe.addEventListener('load', () => {
					if (state.activeId === tab.id) {
						const t = getActiveTab();
						if (t && !findWrap(tab.id).querySelector('.embed-message').classList.contains('visible')) {
							setStatus('Loaded ' + t.url + '. If page is blank, site likely blocks embedding — use Open externally.');
						}
					}
				});

				const msg = document.createElement('div');
				msg.className = 'embed-message';
				const titleDiv = document.createElement('div');
				titleDiv.className = 'message-title';
				titleDiv.textContent = 'This site cannot be shown inside JD Browser';
				const copyDiv = document.createElement('div');
				copyDiv.className = 'message-copy';
				const action = document.createElement('button');
				action.type = 'button';
				action.className = 'message-action';
				action.textContent = 'Open externally';
				action.addEventListener('click', () => {
					const t = state.tabs.find((x) => x.id === tab.id);
					if (t) openExternal(t.url);
				});
				msg.append(titleDiv, copyDiv, action);

				wrap.append(iframe, msg);
				framesEl.appendChild(wrap);

				if (isBlockedEmbedHost(tab.url)) {
					copyDiv.textContent = getHost(tab.url) + ' blocks embedded browsers using security headers. Use Open externally.';
					msg.classList.add('visible');
				} else {
					iframe.src = tab.url;
				}

				return wrap;
			};

			const syncFrames = () => {
				const known = new Set(state.tabs.map((t) => t.id));
				framesEl.querySelectorAll('.frame-wrap').forEach((el) => {
					if (!known.has(el.dataset.tabId)) el.remove();
				});
				state.tabs.forEach((tab) => {
					if (!findWrap(tab.id)) createFrameWrap(tab);
				});
				framesEl.querySelectorAll('.frame-wrap').forEach((el) => {
					el.hidden = el.dataset.tabId !== state.activeId;
				});
			};

			const renderTabs = () => {
				tabsEl.innerHTML = '';
				state.tabs.forEach((tab) => {
					const el = document.createElement('div');
					el.className = 'tab' + (tab.id === state.activeId ? ' active' : '');
					el.title = tab.url;
					const ttl = document.createElement('span');
					ttl.className = 'tab-title';
					ttl.textContent = tab.title || titleFromUrl(tab.url);
					const close = document.createElement('button');
					close.type = 'button';
					close.className = 'tab-close';
					close.title = 'Close tab';
					close.textContent = '×';
					close.addEventListener('click', (e) => {
						e.stopPropagation();
						closeTab(tab.id);
					});
					el.addEventListener('click', () => activateTab(tab.id));
					el.addEventListener('mousedown', (e) => {
						if (e.button === 1) {
							e.preventDefault();
							closeTab(tab.id);
						}
					});
					el.append(ttl, close);
					tabsEl.appendChild(el);
				});
			};

			const syncToolbar = () => {
				const tab = getActiveTab();
				if (!tab) {
					input.value = '';
					backButton.disabled = true;
					forwardButton.disabled = true;
					return;
				}
				input.value = tab.url;
				backButton.disabled = tab.historyIndex <= 0;
				forwardButton.disabled = tab.historyIndex >= tab.history.length - 1;
			};

			const render = () => {
				renderTabs();
				syncFrames();
				syncToolbar();
			};

			const activateTab = (id) => {
				if (state.activeId === id) return;
				state.activeId = id;
				render();
				persist();
			};

			const closeTab = (id) => {
				const idx = state.tabs.findIndex((t) => t.id === id);
				if (idx < 0) return;
				state.tabs.splice(idx, 1);
				if (state.tabs.length === 0) {
					newTab(homeUrl);
					return;
				}
				if (state.activeId === id) {
					state.activeId = state.tabs[Math.max(0, idx - 1)].id;
				}
				render();
				persist();
			};

			const newTab = (url) => {
				const target = normalizeUrl(url || homeUrl);
				const tab = {
					id: uid(),
					url: target,
					title: titleFromUrl(target),
					history: [target],
					historyIndex: 0
				};
				state.tabs.push(tab);
				state.activeId = tab.id;
				render();
				persist();
			};

			const navigate = (value, addToHistory = true) => {
				const tab = getActiveTab();
				if (!tab) return;
				const target = normalizeUrl(value);
				tab.url = target;
				tab.title = titleFromUrl(target);
				if (addToHistory) {
					tab.history = tab.history.slice(0, tab.historyIndex + 1);
					tab.history.push(target);
					tab.historyIndex = tab.history.length - 1;
				}
				const wrap = findWrap(tab.id);
				if (!wrap) {
					render();
					persist();
					return;
				}
				const frame = wrap.querySelector('iframe');
				const msg = wrap.querySelector('.embed-message');
				const copy = msg.querySelector('.message-copy');
				if (isBlockedEmbedHost(target)) {
					frame.removeAttribute('src');
					copy.textContent = getHost(target) + ' blocks embedded browsers using security headers. Use Open externally.';
					msg.classList.add('visible');
					openExternal(target);
					setStatus('Opened externally: ' + target);
				} else {
					msg.classList.remove('visible');
					frame.src = target;
					setStatus('Loading ' + target);
				}
				renderTabs();
				syncToolbar();
				persist();
			};

			const reload = () => {
				const tab = getActiveTab();
				if (!tab) return;
				const wrap = findWrap(tab.id);
				if (!wrap) return;
				const frame = wrap.querySelector('iframe');
				if (isBlockedEmbedHost(tab.url)) {
					openExternal(tab.url);
				} else {
					frame.src = tab.url;
					setStatus('Reloading ' + tab.url);
				}
			};

			input.addEventListener('keydown', (e) => {
				if (!(e.metaKey || e.ctrlKey)) return;
				if (e.key === 't') {
					e.preventDefault();
					newTab(homeUrl);
				} else if (e.key === 'w') {
					e.preventDefault();
					const t = getActiveTab();
					if (t) closeTab(t.id);
				}
			});

			form.addEventListener('submit', (event) => {
				event.preventDefault();
				navigate(input.value);
			});

			backButton.addEventListener('click', () => {
				const tab = getActiveTab();
				if (tab && tab.historyIndex > 0) {
					tab.historyIndex -= 1;
					navigate(tab.history[tab.historyIndex], false);
				}
			});

			forwardButton.addEventListener('click', () => {
				const tab = getActiveTab();
				if (tab && tab.historyIndex < tab.history.length - 1) {
					tab.historyIndex += 1;
					navigate(tab.history[tab.historyIndex], false);
				}
			});

			reloadButton.addEventListener('click', reload);
			homeButton.addEventListener('click', () => navigate(homeUrl));
			externalButton.addEventListener('click', () => {
				const t = getActiveTab();
				if (t) openExternal(t.url);
			});
			newTabButton.addEventListener('click', () => newTab(homeUrl));

			window.addEventListener('message', (event) => {
				const m = event.data || {};
				if (m.command === 'restoreState') {
					restored = true;
					if (m.state && Array.isArray(m.state.tabs) && m.state.tabs.length) {
						const sanitized = m.state.tabs
							.filter((t) => t && typeof t.url === 'string')
							.map((t) => ({
								id: typeof t.id === 'string' ? t.id : uid(),
								url: t.url,
								title: typeof t.title === 'string' ? t.title : titleFromUrl(t.url),
								history: Array.isArray(t.history) && t.history.length ? t.history.filter((h) => typeof h === 'string') : [t.url],
								historyIndex: Number.isInteger(t.historyIndex) ? t.historyIndex : 0
							}))
							.map((t) => ({
								...t,
								historyIndex: Math.max(0, Math.min(t.historyIndex, t.history.length - 1))
							}));
						if (sanitized.length) {
							state.tabs = sanitized;
							const wantedActive = typeof m.state.activeId === 'string' ? m.state.activeId : null;
							state.activeId = sanitized.find((t) => t.id === wantedActive) ? wantedActive : sanitized[0].id;
							render();
							return;
						}
					}
					newTab(homeUrl);
				} else if (m.command === 'clipboardText') {
					if (document.activeElement === input && typeof m.text === 'string') {
						const start = input.selectionStart;
						const end = input.selectionEnd;
						const val = input.value;
						input.value = val.slice(0, start) + m.text + val.slice(end);
						input.selectionStart = input.selectionEnd = start + m.text.length;
					}
				}
			});

			window.addEventListener('keydown', (e) => {
				if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
					if (document.activeElement === input) {
						e.preventDefault();
						vscode.postMessage({ command: 'readClipboard' });
					}
				}
			});

			vscode.postMessage({ command: 'requestState' });

			setTimeout(() => {
				if (!restored) {
					newTab(homeUrl);
				}
			}, 1500);
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
