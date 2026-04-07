# AtlasStack for Visual Studio Code

AI-powered code analysis and security scanning.

CodeSage brings the power of **AtlasStack** directly to your editor. Analyze your codebase, identify vulnerabilities, and get AI-driven fixes without leaving your IDE.

## Features

- **Real-Time Analysis:** Get immediate feedback as you type.
- **Deep Security Scanning:** Detect OWASP Top 10 vulnerabilities and beyond.
- **Performance Insights:** Identify bottlenecks and optimization opportunities.
- **Interactive Results:** Visualize findings with integrated decorations and a dedicated results view.
- **Explain Like I'm 10:** Toggleable ELI5 summaries for complex security issues.

## Getting Started

1. Install the extension.
2. Click the **CodeSage** icon in the activity bar.
3. Configure your server URL (default: `http://localhost:8000`).
4. Run **Analyze Current File** or **Analyze Workspace**.

## Configuration

This extension can be configured in VS Code settings (`ctrl+,`):

- `codesage.serverUrl`: The URL of your CodeSage backend.
- `codesage.apiKey`: Your API key for authentication.
- `codesage.enableRealTimeAnalysis`: Toggle background scanning.

## Support

For issues and feature requests, please visit the [AtlasStack Repository](https://github.com/atlasstack/atlasstack).
