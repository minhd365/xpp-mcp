# Claude Desktop — Setup & Usage

## 1. Configure

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

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

Restart Claude Desktop completely (quit from system tray, relaunch).

## 2. Verify

The server should log to stderr on startup:
```
[xpp-mcp] Loaded 176 models (1 custom: AA)
[xpp-mcp] Server ready
```

Ask Claude: `d365_explore { action:"list_models" }` — it should list your custom models.

---

## 3. Starting the Server (Other Methods)

Claude Desktop starts and stops the server automatically via the config above.
If you need to run the server independently — for example from a terminal or at Windows login
without Claude Desktop — use the scripts in the project root.

### Method A — Foreground (manual, terminal)

```powershell
cd C:\xpp-mcp
powershell -ExecutionPolicy Bypass -File Start-MD365XppMcp.ps1
```

Or double-click `start.bat`.

Press **Ctrl+C** to stop.

### Method B — Auto-start at Windows login (run once as Administrator)

Installs a Windows Scheduled Task that starts the server at every login and
restarts it automatically if it stops:

```powershell
cd C:\xpp-mcp
powershell -ExecutionPolicy Bypass -File Start-MD365XppMcp.ps1 -AsService
```

### Scheduled Task — Management Commands

```powershell
# Check status
Get-ScheduledTask -TaskName XPP-MCP | Select-Object TaskName, State

# Stop the server
Stop-ScheduledTask  -TaskName XPP-MCP

# Start the server
Start-ScheduledTask -TaskName XPP-MCP

# Remove auto-start permanently
powershell -ExecutionPolicy Bypass -File Start-MD365XppMcp.ps1 -Remove
```

### View logs (scheduled task writes here)

```powershell
# Last 30 lines
Get-Content logs\xpp-mcp.log -Tail 30

# Live tail (Ctrl+C to stop)
Get-Content logs\xpp-mcp.log -Tail 30 -Wait
```

---

## Usage Examples

All examples below use model `AA`. Replace with your own model prefix.

### Explore

```
// List all custom models
d365_explore { action:"list_models" }

// List all tables in model AA
d365_explore { action:"list_objects", model:"AA", type:"AxTable" }

// Search by pattern
d365_explore { action:"search", model:"AA", pattern:"AA*", type:"AxTable" }

// Read a specific object's XML
d365_explore { action:"read", model:"AA", type:"AxTable", name:"AAOrderTable" }
```

### Create a Table

```
d365_object {
  action:"create", type:"AxTable", model:"AA",
  name:"AAOrderTable", label:"Order", tableGroup:"WorksheetHeader",
  cacheLookup:"NotInTTS",
  fields:[
    { name:"OrderCode", fieldType:"String", label:"Order Code", mandatory:true },
    { name:"OrderDate", fieldType:"Date",   label:"Order Date", mandatory:true },
    { name:"Status",    fieldType:"Enum",   label:"Status", enumType:"AAOrderStatus" }
  ],
  indexes:[{ name:"OrderCodeIdx", fields:["OrderCode"], unique:true }],
  fieldGroups:[
    { name:"AutoReport",         fields:["OrderCode","OrderDate","Status"] },
    { name:"AutoLookup",         fields:["OrderCode","OrderDate"] },
    { name:"AutoIdentification", fields:["OrderCode"] },
    { name:"AutoSummary",        fields:[] },
    { name:"AutoBrowse",         fields:[] }
  ],
  primaryIndex:"OrderCodeIdx", titleField1:"OrderCode", titleField2:"OrderDate"
}
```

### Create an Enum

```
d365_object {
  action:"create", type:"AxEnum", model:"AA",
  name:"AAOrderStatus", label:"Order Status",
  values:[
    { name:"Draft",     label:"Draft",     value:0 },
    { name:"Confirmed", label:"Confirmed", value:1 },
    { name:"Closed",    label:"Closed",    value:2 }
  ]
}
```

### Create an EDT

```
d365_object {
  action:"create", type:"AxEdt", model:"AA",
  name:"AAOrderCode", edtType:"String", label:"Order Code", stringSize:20
}
```

### Create a SimpleList Form (string-only fields)

```
d365_object {
  action:"create", type:"AxForm", model:"AA",
  name:"AAOrderTable", pattern:"SimpleList",
  caption:"Orders",
  dataSources:[{ table:"AAOrderTable" }],
  listFields:["OrderCode","OrderDate","Status"],
  fieldTypes:{
    "OrderCode": "AxTableFieldString",
    "OrderDate": "AxTableFieldDate",
    "Status":    "AxTableFieldEnum"
  }
}
```

### Create a SimpleListDetails Form with fieldTypes

**Always pass `fieldTypes` for tables that have Date, Enum, Int, Real, or DateTime fields.**

```
d365_object {
  action:"create", type:"AxForm", model:"AA",
  name:"AAOrderTable", pattern:"SimpleListDetails",
  caption:"Orders",
  dataSources:[{ table:"AAOrderTable" }],
  listFields:["OrderCode","OrderDate","Status"],
  fieldTypes:{
    "OrderCode": "AxTableFieldString",
    "OrderDate": "AxTableFieldDate",
    "Status":    "AxTableFieldEnum"
  },
  detailFastTabs:[
    { caption:"General", fields:["OrderCode","OrderDate"] },
    { caption:"Status",  fields:["Status"] }
  ]
}
```

### Create Security Chain (MenuItem → Privilege → Duty → Role → MenuExtension)

```
// 1. Menu item
d365_object { action:"create", type:"AxMenuItemDisplay", model:"AA",
  name:"AAOrderTable", label:"Orders", object:"AAOrderTable", objectType:"Form" }

// 2. View privilege
d365_object { action:"create", type:"AxSecurityPrivilege", model:"AA",
  name:"AAOrderTableView", label:"View Orders",
  entryPoints:[{ menuItem:"AAOrderTable", objectType:"MenuItemDisplay",
    grants:{ read:"Allow", create:"Deny", update:"Deny", delete:"Deny", correct:"Deny" },
    forms:[{ name:"AAOrderTable" }] }] }

// 3. Maintain privilege
d365_object { action:"create", type:"AxSecurityPrivilege", model:"AA",
  name:"AAOrderTableMaintain", label:"Maintain Orders",
  entryPoints:[{ menuItem:"AAOrderTable", objectType:"MenuItemDisplay",
    grants:{ read:"Allow", create:"Allow", update:"Allow", delete:"Allow", correct:"Allow" },
    forms:[{ name:"AAOrderTable" }] }] }

// 4. Duty
d365_object { action:"create", type:"AxSecurityDuty", model:"AA",
  name:"AAViewOrders", label:"View Orders",
  privileges:["AAOrderTableView"] }

// 5. Role
d365_object { action:"create", type:"AxSecurityRole", model:"AA",
  name:"AAOrderViewer", label:"Order Viewer",
  duties:["AAViewOrders"] }

// 6. Add to main menu
d365_object { action:"create", type:"AxMenuExtension", model:"AA",
  name:"MainMenu.AA",
  elements:[{ menuItemName:"AALibraryManagement", menuItemType:"MenuReference" }] }
```

### Build

```
// Compile only — works headlessly via xppc.exe
d365_build { action:"compile", model:"AA" }

// Validate XML metadata (catches DuplicateNamedObjectException etc.)
d365_build { action:"validate_metadata", model:"AA" }

// Best practice check
d365_build { action:"best_practice", model:"AA" }

// Full build — compile + validate_metadata + sync instructions
d365_build { action:"full_build", model:"AA" }
```

#### ⚠️ sync_db Limitation — VS2022 Required

`sync_db` cannot perform the SQL sync standalone. Two hard blockers exist by design:

1. **StaticMetadata missing** — SyncEngine.exe requires pre-compiled binary metadata
   files in `bin\StaticMetadata\`. These are only generated by a full VS2022 platform build.

2. **Password inaccessible** — The DB password in `web.config` is DPAPI-encrypted under
   the AOS service account identity. It cannot be decrypted by the current interactive user.

**After compiling your model, sync in VS2022:**
```
Dynamics 365 → Synchronize database
```

### Inspect an Object

```
d365_object { action:"inspect", type:"AxTable", model:"AA", name:"AAOrderTable" }
```

---

## Important Notes

### ⚠️ Always restart Claude Desktop after recompiling TypeScript

The MCP server loads source into memory at startup. Changes to `build/` are not picked
up until the process restarts. After running `node node_modules\typescript\lib\tsc.js`,
restart Claude Desktop to reload the built JS.

### ⚠️ Build logs location

Build logs are written to:
`<PackagesRoot>\<Model>\xpp-mcp-logs\build-<action>-<timestamp>.log`

The subfolder is created automatically — the model root stays clean.

### Microsoft Best Practice Reminders

- **fieldTypes** — always pass when table has Date/Enum/Int/Real fields. Without it, generator defaults all fields to `AxFormStringControl` (wrong for Date and Enum).
- **Labels** — `useLabels:true` by default; pass `label:` as plain text → becomes `@AALabel:Key`
- **Form captions** — pass plain text, not a label reference. Label refs only resolve from compiled DLL.
- **Naming** — prefix all objects with model prefix (AA, MM, etc.)
- **Field groups** — AutoReport, AutoLookup, AutoIdentification, AutoSummary, AutoBrowse always required
- **Security** — every form needs MenuItem → Privilege → Duty → Role → MenuExtension
- **Never touch standard models** — always verify model is custom before creating
