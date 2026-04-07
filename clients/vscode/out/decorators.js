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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Decorators = void 0;
const vscode = __importStar(require("vscode"));
class Decorators {
    decorationTypes = new Map();
    constructor() {
        // Initialize decoration types for each severity
        this.decorationTypes.set('critical', this.createDecorationType('critical'));
        this.decorationTypes.set('high', this.createDecorationType('high'));
        this.decorationTypes.set('medium', this.createDecorationType('medium'));
        this.decorationTypes.set('low', this.createDecorationType('low'));
        this.decorationTypes.set('info', this.createDecorationType('info'));
    }
    createDecorationType(severity) {
        const colors = {
            critical: 'rgba(255, 0, 0, 0.3)',
            high: 'rgba(255, 107, 107, 0.3)',
            medium: 'rgba(255, 165, 0, 0.3)',
            low: 'rgba(255, 217, 61, 0.3)',
            info: 'rgba(100, 149, 237, 0.2)'
        };
        const overviewColors = {
            critical: '#FF0000',
            high: '#FF6B6B',
            medium: '#FFA500',
            low: '#FFD93D',
            info: '#6495ED'
        };
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: colors[severity],
            overviewRulerColor: overviewColors[severity],
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            isWholeLine: true,
            after: {
                contentText: ` ${severity.toUpperCase()}`,
                color: overviewColors[severity],
                fontWeight: 'bold'
            }
        });
    }
    decorateFindings(editor, findings) {
        // Clear existing decorations
        this.clearDecorations(editor);
        // Group findings by severity
        const findingsBySeverity = new Map();
        for (const finding of findings) {
            const list = findingsBySeverity.get(finding.severity) || [];
            list.push(finding);
            findingsBySeverity.set(finding.severity, list);
        }
        // Apply decorations for each severity
        for (const [severity, severityFindings] of findingsBySeverity) {
            const decorationType = this.decorationTypes.get(severity);
            if (!decorationType)
                continue;
            const decorations = severityFindings.map(finding => {
                const range = new vscode.Range(finding.line_start - 1, 0, finding.line_end - 1, editor.document.lineAt(finding.line_end - 1).text.length);
                return {
                    range,
                    hoverMessage: this.createHoverMessage(finding)
                };
            });
            editor.setDecorations(decorationType, decorations);
        }
    }
    clearDecorations(editor) {
        for (const decorationType of this.decorationTypes.values()) {
            editor.setDecorations(decorationType, []);
        }
    }
    createHoverMessage(finding) {
        const message = new vscode.MarkdownString();
        message.appendMarkdown(`### ${finding.rule_name}\n\n`);
        message.appendMarkdown(`**Severity:** ${finding.severity.toUpperCase()}\n\n`);
        message.appendMarkdown(finding.message);
        message.isTrusted = true;
        return message;
    }
    dispose() {
        for (const decorationType of this.decorationTypes.values()) {
            decorationType.dispose();
        }
        this.decorationTypes.clear();
    }
}
exports.Decorators = Decorators;
//# sourceMappingURL=decorators.js.map