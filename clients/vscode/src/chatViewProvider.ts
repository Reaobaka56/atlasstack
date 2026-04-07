import * as vscode from 'vscode';
import { WebSocketClient } from './websocketClient';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codesage.chat';
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

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'sendMessage': {
                    this._wsClient.sendChatMessage(data.value);
                    break;
                }
            }
        });

        // Handle incoming messages from the WebSocket client
        this._wsClient.onChatResponse((message: string) => {
            this._view?.webview.postMessage({ type: 'addResponse', value: message });
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<style>
					body {
						background-color: #0d1117;
						color: #e6edf3;
						padding: 20px;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
						display: flex;
						flex-direction: column;
						height: 100vh;
						margin: 0;
					}

					.chat-container {
						flex: 1;
						overflow-y: auto;
						display: flex;
						flex-direction: column;
						gap: 16px;
						margin-bottom: 20px;
						padding-right: 8px;
					}

					.message {
						padding: 12px 16px;
						border-radius: 12px;
						max-width: 90%;
						line-height: 1.5;
						font-size: 13px;
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
						box-shadow: 0 4px 12px rgba(0,0,0,0.1);
					}

					.input-container {
						background: rgba(255, 255, 255, 0.03);
						border: 1px solid rgba(255, 255, 255, 0.1);
						border-radius: 16px;
						padding: 8px;
						display: flex;
						gap: 8px;
						backdrop-filter: blur(10px);
					}

					textarea {
						flex: 1;
						background: transparent;
						border: none;
						color: #fff;
						padding: 10px;
						resize: none;
						font-family: inherit;
						font-size: 13px;
						max-height: 120px;
					}

					textarea:focus {
						outline: none;
					}

					button {
						background: #fff;
						color: #000;
						border: none;
						padding: 0 16px;
						border-radius: 12px;
						cursor: pointer;
						font-weight: 700;
						transition: all 0.2s;
						font-size: 12px;
					}

					button:hover {
						background: #e6e6e6;
						transform: scale(1.02);
					}

					button:active {
						transform: scale(0.98);
					}

					.typing-indicator {
						font-size: 11px;
						color: #8b949e;
						margin-left: 8px;
						display: none;
					}

					/* Custom Scrollbar */
					::-webkit-scrollbar { width: 4px; }
					::-webkit-scrollbar-track { background: transparent; }
					::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
				</style>
			</head>
			<body>
				<div class="chat-container" id="chat">
					<div class="message ai-message">
						Hello! I'm your AtlasStack AI architect. How can I help you today?
					</div>
				</div>
				
				<div class="typing-indicator" id="typing">AI is scanning...</div>

				<div class="input-container">
					<textarea id="prompt" placeholder="Ask anything about your code..." rows="1"></textarea>
					<button id="send">Send</button>
				</div>

				<script>
					const vscode = acquireVsCodeApi();
					const chat = document.getElementById('chat');
					const prompt = document.getElementById('prompt');
					const send = document.getElementById('send');
					const typing = document.getElementById('typing');

					function addMessage(text, type) {
						const div = document.createElement('div');
						div.className = 'message ' + type + '-message';
						div.innerText = text;
						chat.appendChild(div);
						chat.scrollTop = chat.scrollHeight;
					}

					send.addEventListener('click', () => {
						const text = prompt.value.trim();
						if (text) {
							addMessage(text, 'user');
							vscode.postMessage({ type: 'sendMessage', value: text });
							prompt.value = '';
							typing.style.display = 'block';
						}
					});

					prompt.addEventListener('keydown', (e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							send.click();
						}
					});

					window.addEventListener('message', event => {
						const message = event.data;
						switch (message.type) {
							case 'addResponse':
								typing.style.display = 'none';
								addMessage(message.value, 'ai');
								break;
						}
					});
				</script>
			</body>
			</html>`;
    }
}
