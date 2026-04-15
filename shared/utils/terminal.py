"""
AtlasStack Terminal UI Utilities
Provides high-fidelity terminal rendering using 'rich'.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.theme import Theme
from rich.live import Live
from rich.align import Align
from rich import box

# Custom theme for AtlasStack (Liquid Glass / Silver aesthetic)
atlas_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "danger": "bold red",
    "success": "bold green",
    "header": "bold white",
    "muted": "grey50",
    "premium": "bold magenta",
    "silver": "bold white",
})

console = Console(theme=atlas_theme)

def print_header():
    """Prints a premium AtlasStack ASCII header."""
    header_text = """
    [silver]
    █████╗ ████████╗██╗      █████╗ ███████╗███████╗████████╗ █████╗  ██████╗██╗  ██╗
    ██╔══██╗╚══██╔══╝██║     ██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ███████║   ██║   ██║     ███████║███████╗███████╗   ██║   ███████║██║     █████╔╝ 
    ██╔══██║   ██║   ██║     ██╔══██║╚════██║╚════██║   ██║   ██╔══██║██║     ██╔═██╗ 
    ██║  ██║   ██║   ███████╗██║  ██║███████║███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
    [/silver]
    [premium]Premium Autonomous Engineering Engine v1.0[/premium]
    """
    console.print(Align.center(header_text))

def render_analysis_report(data: dict):
    """Renders a full analysis report in the terminal."""
    
    # 1. Summary Section
    explanation = data.get("explanation", {})
    summary = explanation.get("summary", "No summary available.")
    eli5 = explanation.get("eli5_summary", "")
    
    console.print(Panel(
        Markdown(f"### 🎯 Summary\n{summary}\n\n### 🧸 ELI5\n{eli5}"),
        title="[header]Repository Analysis[/header]",
        border_style="silver",
        box=box.ROUNDED
    ))

    # 2. Tech Stack & Health
    tech_stack = data.get("tech_stack", {})
    health_score = data.get("health_score", 0)
    tech_debt = data.get("tech_debt_score", 0)
    maturity = data.get("maturity_level", "Unknown")

    grid = Table.grid(expand=True)
    grid.add_column(justify="left")
    grid.add_column(justify="right")
    
    health_color = "success" if health_score > 70 else "warning" if health_score > 40 else "danger"
    grid.add_row(
        f"[header]Health Score:[/header] [{health_color}]{health_score}/100[/{health_color}]",
        f"[header]Maturity:[/header] [premium]{maturity}[/premium]"
    )
    grid.add_row(
        f"[header]Tech Debt:[/header] [danger]{tech_debt}/100[/danger]",
        f"[header]Frameworks:[/header] {', '.join(tech_stack.get('frameworks', []))}"
    )
    
    console.print(Panel(grid, title="[header]Project Vitals[/header]", border_style="grey50"))

    # 3. Security Report
    security = data.get("security_report", {})
    deps = security.get("dependencies", [])
    if deps:
        table = Table(title="[danger]Security & Dependency Analysis[/danger]", box=box.SIMPLE, expand=True)
        table.add_column("Dependency", style="cyan")
        table.add_column("Version", style="muted")
        table.add_column("Risk Score", justify="center")
        table.add_column("Vulnerabilities", style="warning")

        for d in deps:
            risk_color = "red" if d['risk_score'] > 7 else "yellow" if d['risk_score'] > 4 else "green"
            table.add_row(
                d['name'], 
                d['version'], 
                f"[{risk_color}]{d['risk_score']}[/{risk_color}]",
                ", ".join([v.get('cve_id', 'Unknown') for v in d.get('vulnerabilities', [])]) or "None"
            )
        console.print(table)

    # 4. Proprosed Fixes
    fixes = data.get("fixes", [])
    if fixes:
        console.print("\n[header]🛠 Recommended Improvements[/header]")
        for i, fix in enumerate(fixes, 1):
            console.print(Panel(
                f"[header]Problem:[/header] {fix['problem']}\n"
                f"[header]File:[/header] [cyan]{fix['file_path']}[/cyan]\n"
                f"[header]Explanation:[/header] {fix.get('eli5_explanation', '')}\n\n"
                f"```diff\n- {fix.get('code_remove', '')}\n+ {fix.get('code_add', '')}\n```",
                title=f"Fix #{i}",
                border_style="cyan",
                box=box.MINIMAL
            ))

    # 5. Run Steps
    steps = data.get("run_steps", [])
    if steps:
        console.print("\n[success]🚀 Getting Started[/success]")
        for step in steps:
            console.print(f"  [muted]•[/muted] [silver]{step}[/silver]")

def create_progress():
    """Returns a pre-configured progress bar for analysis."""
    return Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=None),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console,
        transient=True
    )
