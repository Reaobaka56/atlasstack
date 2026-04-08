"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const vscode = __importStar(require("vscode"));
const ws_1 = __importDefault(require("ws"));
class WebSocketClient {
    ws = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 5000;
    pingInterval = null;
    chatCallback = null;
    async connect(url, apiKey) {
        return new Promise((resolve, reject) => {
            try {
                // Convert http to ws
                const wsUrl = url.replace(/^http/, 'ws') + '/ws';
                const headers = {};
                if (apiKey) {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }
                this.ws = new ws_1.default(wsUrl, { headers });
                this.ws.on('open', () => {
                    console.log('WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.startPingInterval();
                    resolve();
                });
                this.ws.on('message', (data) => {
                    this.handleMessage(data.toString());
                });
                this.ws.on('error', (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                });
                this.ws.on('close', () => {
                    console.log('WebSocket closed');
                    this.stopPingInterval();
                    this.attemptReconnect(url, apiKey);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    disconnect() {
        this.stopPingInterval();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            switch (message.type) {
                case 'analysis_update':
                    this.handleAnalysisUpdate(message);
                    break;
                case 'notification':
                    this.handleNotification(message);
                    break;
                case 'chat_response':
                    this.handleChatResponse(message);
                    break;
                case 'pong':
                    // Ping response, do nothing
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        }
        catch (error) {
            console.error('Failed to parse message:', error);
        }
    }
    handleAnalysisUpdate(message) {
        const { analysis_id, status, progress } = message;
        if (status === 'completed') {
            vscode.window.showInformationMessage(`Analysis ${analysis_id} completed`, 'View Results').then(selection => {
                if (selection === 'View Results') {
                    vscode.commands.executeCommand('atlasstack.showResults');
                }
            });
        }
        else if (status === 'failed') {
            vscode.window.showErrorMessage(`Analysis ${analysis_id} failed: ${message.error}`);
        }
    }
    handleNotification(message) {
        const { level, text } = message;
        switch (level) {
            case 'info':
                vscode.window.showInformationMessage(text);
                break;
            case 'warning':
                vscode.window.showWarningMessage(text);
                break;
            case 'error':
                vscode.window.showErrorMessage(text);
                break;
        }
    }
    handleChatResponse(message) {
        const { text } = message;
        if (this.chatCallback) {
            this.chatCallback(text);
        }
    }
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    attemptReconnect(url, apiKey) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            vscode.window.showErrorMessage('Lost connection to AtlasStack server. Please check your connection and try again.', 'Reconnect').then(selection => {
                if (selection === 'Reconnect') {
                    this.reconnectAttempts = 0;
                    this.connect(url, apiKey);
                }
            });
            return;
        }
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => {
            this.connect(url, apiKey).catch(() => {
                // Reconnection failed, will try again
            });
        }, delay);
    }
    subscribeToAnalysis(analysisId) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                analysis_id: analysisId
            }));
        }
    }
    sendChatMessage(text) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'chat',
                text: text
            }));
        }
        else {
            vscode.window.showErrorMessage('Not connected to AtlasStack server');
        }
    }
    onChatResponse(callback) {
        this.chatCallback = callback;
    }
}
exports.WebSocketClient = WebSocketClient;
//# sourceMappingURL=websocketClient.js.map