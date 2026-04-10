import * as vscode from 'vscode';
import { AnalysisProvider } from './analysisProvider';
import { WebSocketClient } from './websocketClient';
import { Decorators } from './decorators';
import { ChatViewProvider } from './chatViewProvider';

let analysisProvider: AnalysisProvider;
let wsClient: WebSocketClient;
let decorators: Decorators;
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('AtlasStack extension is now active');

    // Initialize components
    analysisProvider = new AnalysisProvider();
    wsClient = new WebSocketClient();
    decorators = new Decorators();
    diagnosticCollection = vscode.languages.createDiagnosticCollection('atlasstack');
    const chatProvider = new ChatViewProvider(context.extensionUri, wsClient);

    // Register tree data provider
    vscode.window.registerTreeDataProvider('atlasstackResults', analysisProvider);
    
    // Register webview view provider
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('atlasstack.analyzeFile', analyzeFile),
        vscode.commands.registerCommand('atlasstack.analyzeSelection', analyzeSelection),
        vscode.commands.registerCommand('atlasstack.analyzeWorkspace', analyzeWorkspace),
        vscode.commands.registerCommand('atlasstack.showResults', showResults),
        vscode.commands.registerCommand('atlasstack.configure', configure),
        vscode.commands.registerCommand('atlasstack.connect', connect),
        vscode.commands.registerCommand('atlasstack.disconnect', disconnect),
        vscode.commands.registerCommand('atlasstack.refreshResults', () => analysisProvider.refresh()),
        vscode.commands.registerCommand('atlasstack.openChat', () => {
            vscode.commands.executeCommand('atlasstack.chat.focus');
        }),
        vscode.commands.registerCommand('atlasstack.search', async (query: string) => {
            try {
                const results = await analysisProvider.search(query);
                chatProvider.postMessage({ type: 'searchResults', results });
            } catch (error) {
                vscode.window.showErrorMessage(`Search failed: ${error}`);
            }
        })
    );

    // Set up real-time analysis if enabled
    const config = vscode.workspace.getConfiguration('atlasstack');
    if (config.get('enableRealTimeAnalysis')) {
        setupRealTimeAnalysis(context);
    }

    // Connect to server
    connect();

    // Show welcome message
    vscode.window.showInformationMessage(
        'AtlasStack is ready! Use \"AtlasStack: Analyze Current File\" to get started.',
        'Analyze File',
        'Configure'
    ).then(selection => {
        if (selection === 'Analyze File') {
            vscode.commands.executeCommand('atlasstack.analyzeFile');
        } else if (selection === 'Configure') {
            vscode.commands.executeCommand('atlasstack.configure');
        }
    });
}

export function deactivate() {
    // Clean up
    if (wsClient) {
        wsClient.disconnect();
    }
}

async function analyzeFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const document = editor.document;
    const filePath = document.fileName;
    const language = document.languageId;
    const content = document.getText();

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AtlasStack: Analyzing file...',
        cancellable: false
    }, async (progress) => {
        try {
            const results = await analysisProvider.analyzeCode(content, language, filePath);
            
            if (results.findings && results.findings.length > 0) {
                decorators.decorateFindings(editor, results.findings);
                vscode.window.showInformationMessage(
                    `Analysis complete: ${results.findings.length} findings`,
                    'View Results'
                ).then(selection => {
                    if (selection === 'View Results') {
                        showResults();
                    }
                });
            } else {
                vscode.window.showInformationMessage('Analysis complete: No issues found');
                decorators.clearDecorations(editor);
            }
            
            analysisProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error}`);
        }
    });
}

async function analyzeSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage('No code selected');
        return;
    }

    const code = editor.document.getText(selection);
    const language = editor.document.languageId;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AtlasStack: Analyzing selection...',
        cancellable: false
    }, async () => {
        try {
            const results = await analysisProvider.analyzeCode(code, language);
            
            if (results.findings && results.findings.length > 0) {
                vscode.window.showWarningMessage(
                    `Found ${results.findings.length} issues in selection`,
                    'View Details'
                ).then(selection => {
                    if (selection === 'View Details') {
                        showResults();
                    }
                });
            } else {
                vscode.window.showInformationMessage('No issues found in selection');
            }
            
            analysisProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${error}`);
        }
    });
}

async function analyzeWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showWarningMessage('No workspace open');
        return;
    }

    const folder = workspaceFolders[0];
    
    const result = await vscode.window.showQuickPick(
        ['Security Scan', 'Performance Analysis', 'Full Analysis'],
        { placeHolder: 'Select analysis type' }
    );

    if (!result) return;

    const analysisTypes: string[] = [];
    if (result === 'Security Scan') analysisTypes.push('security');
    if (result === 'Performance Analysis') analysisTypes.push('performance');
    if (result === 'Full Analysis') analysisTypes.push('security', 'performance', 'quality');

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AtlasStack: Analyzing workspace...',
        cancellable: true
    }, async (progress, token) => {
        try {
            // This would trigger a background analysis job
            vscode.window.showInformationMessage(
                'Workspace analysis started. Results will be available in the AtlasStack panel.',
                'OK'
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Workspace analysis failed: ${error}`);
        }
    });
}

function showResults() {
    vscode.commands.executeCommand('atlasstackResults.focus');
}

async function configure() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'atlasstack');
}

async function connect() {
    const config = vscode.workspace.getConfiguration('atlasstack');
    const serverUrl = config.get<string>('serverUrl');
    const apiKey = config.get<string>('apiKey');

    if (!serverUrl) {
        vscode.window.showWarningMessage(
            'AtlasStack server URL not configured',
            'Configure'
        ).then(selection => {
            if (selection === 'Configure') {
                configure();
            }
        });
        return;
    }

    try {
        await wsClient.connect(serverUrl, apiKey);
        vscode.commands.executeCommand('setContext', 'atlasstack:connected', true);
        vscode.window.showInformationMessage('Connected to AtlasStack server');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect: ${error}`);
    }
}

async function disconnect() {
    wsClient.disconnect();
    vscode.commands.executeCommand('setContext', 'atlasstack:connected', false);
    vscode.window.showInformationMessage('Disconnected from AtlasStack server');
}

function setupRealTimeAnalysis(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('atlasstack');
    const delay = config.get<number>('analysisDelay') || 1000;

    let timeout: NodeJS.Timeout | undefined;

    vscode.workspace.onDidChangeTextDocument(
            timeout = setTimeout(async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && event.document === editor.document) {
                    const content = event.document.getText();
                    const language = event.document.languageId;
                    
                    try {
                        const results = await analysisProvider.analyzeCode(content, language);
                        if (results.findings) {
                            const diagnostics: vscode.Diagnostic[] = results.findings.map((f: any) => {
                                const range = new vscode.Range(
                                    f.line - 1, 0,
                                    f.line - 1, 100
                                );
                                const diagnostic = new vscode.Diagnostic(
                                    range,
                                    `[AtlasStack] ${f.message} (${f.severity})`,
                                    f.severity === 'critical' || f.severity === 'high' 
                                        ? vscode.DiagnosticSeverity.Error 
                                        : vscode.DiagnosticSeverity.Warning
                                );
                                return diagnostic;
                            });
                            diagnosticCollection.set(event.document.uri, diagnostics);
                        }
                    } catch (e) {
                        console.error('Real-time scan failed', e);
                    }
                }
            }, delay);
        },
        null,
        context.subscriptions
    );
}
