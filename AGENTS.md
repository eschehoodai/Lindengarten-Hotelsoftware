# Mandatory Tool Usage & Workflow Rules
- Du hast Zugriff auf `context-mode` und `serena` MCP-Server.
- **Zwingende Regel:** Nutze für Code-Analysen, Symbol-Suchen und Code-Änderungen NIEMALS die Standard-Volltextlesung, wenn Serena (`find_symbol`, `replace_symbol_body`, etc.) verfügbar ist.
- **Zwingende Regel:** Nutze für Terminal-Logs, Build-Ausgaben und das Durchsuchen lokaler Dokumentationen (wie DIRS21 oder TSE-Spezifikationen) immer die `context-mode`-Sandbox-Tools.
- Führe diese Tools proaktiv bei jedem Programmier- oder Debugging-Schritt aus, ohne dass der Nutzer dich separat daran erinnern muss.
