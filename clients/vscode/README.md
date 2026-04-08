# AtlasStack for Visual Studio Code

AI-powered code analysis and security scanning.

AtlasStack brings the power of AI directly to your editor. Analyze your codebase, identify vulnerabilities, and get AI-driven fixes without leaving your IDE.

## Features

- **Real-Time Analysis:** Get immediate feedback as you type.
- **Deep Security Scanning:** Detect OWASP Top 10 vulnerabilities and beyond.
- **Performance Insights:** Identify bottlenecks and optimization opportunities.
- **Interactive Results:** Visualize findings with integrated decorations and a dedicated results view.
- **Explain Like I'm 10:** Toggleable ELI5 summaries for complex security issues.

## Getting Started

1. Install the extension.
2. Click the **AtlasStack** icon in the activity bar.
3. Configure your server URL (default: `http://localhost:8000`).
4. Run **Analyze Current File** or **Analyze Workspace**.

## Configuration

This extension can be configured in VS Code settings (`ctrl+,`):

- `atlasstack.serverUrl`: The URL of your AtlasStack backend.
- `atlasstack.apiKey`: Your API key for authentication.
- `atlasstack.enableRealTimeAnalysis`: Toggle background scanning.

## Support

For issues and feature requests, please visit the [AtlasStack Repository](https://github.com/atlasstack/atlasstack).
