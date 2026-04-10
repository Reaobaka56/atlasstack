import * as vscode from 'vscode';
import { WebSocketClient } from './websocketClient';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'atlasstack.chat';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _wsClient: WebSocketClient
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'sendMessage': {
                    this._wsClient.sendChatMessage(data.value);
                    break;
                }
                case 'searchCode': {
                    // This will be handled in the extension.ts or passed back
                    vscode.commands.executeCommand('atlasstack.search', data.value);
                    break;
                }
                case 'openFile': {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(data.path));
                    await vscode.window.showTextDocument(doc);
                    break;
                }
            }
        });

        // Handle incoming messages from the WebSocket client
        this._wsClient.onChatResponse((message: string) => {
            this._view?.webview.postMessage({ type: 'addResponse', value: message });
        });
    }

    public postMessage(message: any) {
        this._view?.webview.postMessage(message);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<style>
					body {
						background-color: #0d1117;
						color: #e6edf3;
						padding: 0;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
						display: flex;
						flex-direction: column;
						height: 100vh;
						margin: 0;
					}

					.tabs {
						display: flex;
						background: rgba(255, 255, 255, 0.02);
						border-bottom: 1px solid rgba(255, 255, 255, 0.1);
						padding: 0 10px;
					}

					.tab {
						padding: 12px 16px;
						font-size: 11px;
						font-weight: 800;
						text-transform: uppercase;
						letter-spacing: 0.1em;
						cursor: pointer;
						color: #8b949e;
						transition: all 0.2s;
					}

					.tab.active {
						color: #fff;
						border-bottom: 2px solid #fff;
					}

					.content-pane {
						display: none;
						flex: 1;
						flex-direction: column;
						padding: 16px;
						overflow: hidden;
					}

					.content-pane.active {
						display: flex;
					}

					.chat-container {
						flex: 1;
						overflow-y: auto;
						display: flex;
						flex-direction: column;
						gap: 16px;
						margin-bottom: 12px;
					}

					.message {
						padding: 12px 16px;
						border-radius: 12px;
						max-width: 90%;
						line-height: 1.5;
						font-size: 12px;
						animation: fadeIn 0.3s ease-out;
					}

					@keyframes fadeIn {
						from { opacity: 0; transform: translateY(4px); }
						to { opacity: 1; transform: translateY(0); }
					}

					.user-message {
						align-self: flex-end;
						background: rgba(255, 255, 255, 0.05);
						border: 1px solid rgba(255, 255, 255, 0.1);
						color: #fff;
						border-bottom-right-radius: 4px;
					}

					.ai-message {
						align-self: flex-start;
						background: linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
						border: 1px solid rgba(192, 192, 192, 0.1);
						color: #c9d1d9;
						border-bottom-left-radius: 4px;
					}

					.search-container {
						display: flex;
						flex-direction: column;
						gap: 12px;
						height: 100%;
					}

					.input-container {
						background: rgba(255, 255, 255, 0.03);
						border: 1px solid rgba(255, 255, 255, 0.1);
						border-radius: 12px;
						padding: 6px;
						display: flex;
						gap: 6px;
					}

					textarea, input {
						flex: 1;
						background: transparent;
						border: none;
						color: #fff;
						padding: 8px;
						font-family: inherit;
						font-size: 12px;
					}

					textarea:focus, input:focus { outline: none; }

					button {
						background: #fff;
						color: #000;
						border: none;
						padding: 0 12px;
						border-radius: 8px;
						cursor: pointer;
						font-weight: 700;
						font-size: 11px;
					}

					.results-container {
						flex: 1;
						overflow-y: auto;
						display: flex;
						flex-direction: column;
						gap: 8px;
						margin-top: 10px;
					}

					.result-card {
						background: rgba(255,255,255,0.02);
						border: 1px solid rgba(255,255,255,0.05);
						padding: 10px;
						border-radius: 8px;
						cursor: pointer;
						transition: all 0.2s;
					}

					.result-card:hover {
						background: rgba(255,255,255,0.05);
						border-color: rgba(255,255,255,0.1);
					}

					.result-title { font-weight: 800; font-size: 11px; color: #fff; margin-bottom: 4px; }
					.result-path { font-size: 10px; color: #8b949e; font-family: monospace; }

					::-webkit-scrollbar { width: 4px; }
					::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
				</style>
			</head>
			<body>
				<div class="tabs">
					<div class="tab active" data-tab="chat-pane">Chat</div>
					<div class="tab" data-tab="intel-pane">Intelligence</div>
				</div>

				<div id="chat-pane" class="content-pane active">
					<div class="chat-container" id="chat">
						<div class="message ai-message">How can I help you today?</div>
					</div>
					<div class="input-container">
						<textarea id="prompt" placeholder="Ask AI Architect..." rows="1"></textarea>
						<button id="send">Send</button>
					</div>
				</div>

				<div id="intel-pane" class="content-pane">
					<div class="search-container">
						<div class="input-container">
							<input id="search-input" placeholder="Semantic search code..." />
							<button id="search-btn">Search</button>
						</div>
						<div class="results-container" id="results">
							<div style="text-align:center; color:#8b949e; font-size:10px; margin-top:20px;">
								Search for components, logic, or vulnerabilities.
							</div>
						</div>
					</div>
				</div>

				<script>
					const vscode = acquireVsCodeApi();
					
					// Tab Logic
					document.querySelectorAll('.tab').forEach(tab => {
						tab.addEventListener('click', () => {
							document.querySelectorAll('.tab, .content-pane').forEach(el => el.classList.remove('active'));
							tab.classList.add('active');
							document.getElementById(tab.dataset.tab).classList.add('active');
						});
					});

					// Chat Logic
					const chat = document.getElementById('chat');
					const prompt = document.getElementById('prompt');
					const send = document.getElementById('send');

					send.addEventListener('click', () => {
						const text = prompt.value.trim();
						if (text) {
							const div = document.createElement('div');
							div.className = 'message user-message';
							div.innerText = text;
							chat.appendChild(div);
							vscode.postMessage({ type: 'sendMessage', value: text });
							prompt.value = '';
						}
					});

					// Search Logic
					const searchInput = document.getElementById('search-input');
					const searchBtn = document.getElementById('search-btn');
					const results = document.getElementById('results');

					searchBtn.addEventListener('click', () => {
						const text = searchInput.value.trim();
						if (text) {
							results.innerHTML = '<div style="text-align:center; font-size:10px; color:#8b949e;">Scanning vector space...</div>';
							vscode.postMessage({ type: 'searchCode', value: text });
						}
					});

					window.addEventListener('message', event => {
						const message = event.data;
						if (message.type === 'addResponse') {
							const div = document.createElement('div');
							div.className = 'message ai-message';
							div.innerText = message.value;
							chat.appendChild(div);
							chat.scrollTop = chat.scrollHeight;
						} else if (message.type === 'searchResults') {
							results.innerHTML = '';
							if (message.results.length === 0) {
								results.innerHTML = '<div style="text-align:center; font-size:10px; color:#8b949e;">No results found.</div>';
							}
							message.results.forEach(res => {
								const card = document.createElement('div');
								card.className = 'result-card';
								card.innerHTML = \`<div class="result-title">\${res.name}</div><div class="result-path">\${res.file_path}</div>\`;
								card.onclick = () => vscode.postMessage({ type: 'openFile', path: res.file_path });
								results.appendChild(card);
							});
						}
					});
				</script>
			</body>
			</html>`;
    }
}
