import * as vscode from 'vscode';
interface Finding {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    line_start: number;
    line_end: number;
    message: string;
    rule_name: string;
}
export declare class Decorators {
    private decorationTypes;
    constructor();
    private createDecorationType;
    decorateFindings(editor: vscode.TextEditor, findings: Finding[]): void;
    clearDecorations(editor: vscode.TextEditor): void;
    private createHoverMessage;
    dispose(): void;
}
export {};
//# sourceMappingURL=decorators.d.ts.map
