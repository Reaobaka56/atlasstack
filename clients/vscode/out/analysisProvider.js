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
exports.AnalysisProvider = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class AnalysisProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    findings = [];
    currentFile;
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - group by severity
            const severities = ['critical', 'high', 'medium', 'low', 'info'];
            return Promise.resolve(severities
                .filter(sev => this.findings.some(f => f.severity === sev))
                .map(sev => new SeverityItem(sev, this.findings.filter(f => f.severity === sev).length, vscode.TreeItemCollapsibleState.Collapsed)));
        }
        else if (element instanceof SeverityItem) {
            // Severity level - show findings
            return Promise.resolve(this.findings
                .filter(f => f.severity === element.severity)
                .map(f => new FindingItem(f)));
        }
        return Promise.resolve([]);
    }
    async analyzeCode(code, language, filePath) {
        const config = vscode.workspace.getConfiguration('codesage');
        const serverUrl = config.get('serverUrl');
        const apiKey = config.get('apiKey');
        const analysisTypes = config.get('analysisTypes') || ['security', 'performance'];
        if (!serverUrl) {
            throw new Error('CodeSage server URL not configured');
        }
        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const response = await axios_1.default.post(`${serverUrl}/api/v1/analyze`, {
            snippet: {
                code,
                language,
                filename: filePath ? filePath.split('/').pop() : undefined
            },
            analysis_types: analysisTypes,
            options: {
                include_suggestions: true,
                include_explanations: true
            }
        }, { headers });
        this.findings = response.data.findings || [];
        this.currentFile = filePath;
        this.refresh();
        return response.data;
    }
    getFindings() {
        return this.findings;
    }
    clearFindings() {
        this.findings = [];
        this.refresh();
    }
}
exports.AnalysisProvider = AnalysisProvider;
class AnalysisItem extends vscode.TreeItem {
    label;
    collapsibleState;
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}
class SeverityItem extends AnalysisItem {
    severity;
    count;
    constructor(severity, count, collapsibleState) {
        super(`${severity.toUpperCase()} (${count})`, collapsibleState);
        this.severity = severity;
        this.count = count;
        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor(`codesage.${severity}`));
        this.contextValue = 'severity';
    }
}
class FindingItem extends AnalysisItem {
    finding;
    constructor(finding) {
        super(finding.rule_name, vscode.TreeItemCollapsibleState.None);
        this.finding = finding;
        this.description = `Line ${finding.line_start}: ${finding.message.substring(0, 50)}...`;
        this.tooltip = finding.message;
        this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(`codesage.${finding.severity}`));
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [
                vscode.Uri.file(finding.file_path),
                {
                    selection: new vscode.Range(finding.line_start - 1, 0, finding.line_end - 1, 0)
                }
            ]
        };
        this.contextValue = 'finding';
    }
}
//# sourceMappingURL=analysisProvider.js.map