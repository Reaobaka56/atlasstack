export declare class WebSocketClient {
    private ws;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private pingInterval;
    connect(url: string, apiKey?: string): Promise<void>;
    disconnect(): void;
    private handleMessage;
    private handleAnalysisUpdate;
    private handleNotification;
    private startPingInterval;
    private stopPingInterval;
    private attemptReconnect;
    subscribeToAnalysis(analysisId: string): void;
}
//# sourceMappingURL=websocketClient.d.ts.map
