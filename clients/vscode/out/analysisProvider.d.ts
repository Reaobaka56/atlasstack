import * as vscode from 'vscode';
interface Finding {
    id: string;
    rule_id: string;
    rule_name: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    message: string;
    file_path: string;
    line_start: number;
    line_end: number;
    code_snippet?: string;
    suggestion?: string;
}
interface AnalysisResult {
    id: string;
    status: string;
    findings: Finding[];
    metrics?: {
        complexity_score?: number;
        maintainability_index?: number;
        lines_of_code: number;
    };
    summary?: {
        total_findings: number;
        severity_counts: Record<string, number>;
    };
}
export declare class AnalysisProvider implements vscode.TreeDataProvider<AnalysisItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<AnalysisItem | undefined | null | void>;
    private findings;
    private currentFile;
    refresh(): void;
    getTreeItem(element: AnalysisItem): vscode.TreeItem;
    getChildren(element?: AnalysisItem): Thenable<AnalysisItem[]>;
    analyzeCode(code: string, language: string, filePath?: string): Promise<AnalysisResult>;
    getFindings(): Finding[];
    clearFindings(): void;
}
declare class AnalysisItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState);
}
export {};
//# sourceMappingURL=analysisProvider.d.ts.map