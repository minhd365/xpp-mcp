# VS Code — Setup & Usage

xpp-mcp works with **VS Code + Claude Code extension** (or the Claude Code CLI)
using the same stdio MCP transport as Claude Desktop.

---

## 1. Prerequisites

- [VS Code](https://code.visualstudio.com/) installed
- [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code) installed
  (search "Claude Code" in the VS Code Extensions panel)
- Node.js 20+ installed
- xpp-mcp built: `npm install && npm run build`

---

## 2. Configure

Add to `~/.claude/settings.json` (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "xpp-mcp": {
      "command": "node",
      "args": ["C:/xpp-mcp/build/index.js"],
      "cwd": "C:/xpp-mcp"
    }
  }
}
```

> **Path:** `~/.claude/settings.json` resolves to `C:\Users\<YourUser>\.claude\settings.json` on Windows.
> Adjust the `args` path if you cloned the repo to a different location.

---

## 3. Verify

Reload VS Code (or run **Developer: Reload Window** from the command palette).

In VS Code, open a Claude Code chat panel and ask:

```
d365_explore { action:"list_models" }
```

Expected output lists your custom models (e.g. `AA`, `MM`).

You can also verify via the Claude Code CLI in any terminal:

```powershell
claude
> d365_explore { action:"list_models" }
```

---

## 4. Workflow: Create Objects → Build → Sync in VS2022

The recommended workflow when using VS Code + Claude Code:

```
1. In Claude Code chat (VS Code):
   Create objects via d365_object, validate and compile via d365_build

2. In VS2022 (open alongside VS Code):
   Dynamics 365 → Synchronize database
   (required after any new table, field, enum, or EDT)

3. Write X++ business logic in VS2022 as usual
   VS2022 detects the MCP-written XML files automatically via its file watcher
```

### Build commands

```
// Validate XML — catches DuplicateNamedObjectException before VS2022
d365_build { action:"validate_metadata", model:"AA" }

// Compile X++ source (headless via xppc.exe)
d365_build { action:"compile", model:"AA" }

// Best practice check
d365_build { action:"best_practice", model:"AA" }

// Full headless build (validate + compile), then sync manually in VS2022
d365_build { action:"full_build", model:"AA" }
```

---

## 5. Workspace-level config (optional)

If you want the MCP server scoped to a specific D365 workspace, you can override
`~/.claude/settings.json` with a workspace-level file at `.claude/settings.json`
inside your workspace folder. The format is identical.

This is useful when working on multiple D365 VMs or models with different `packagesRoot` paths.

---

## Differences from Claude Desktop

| | Claude Desktop | VS Code + Claude Code |
|---|---|---|
| Config file | `%APPDATA%\Claude\claude_desktop_config.json` | `~/.claude/settings.json` |
| MCP config key | `mcpServers` | `mcpServers` |
| Server config | identical | identical |
| Restart required | Quit + relaunch Claude Desktop | Reload VS Code window |
| Usage | Claude Desktop chat panel | VS Code Claude Code chat panel or CLI |
