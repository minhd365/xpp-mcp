---
name: mcp-xpp-server
description: >
  Setup, configuration, and usage of xpp-mcp — an MCP server for Microsoft
  Dynamics 365 Finance & Operations X++ development. Pure TypeScript, no C# sidecar,
  no VS2022 required for object creation.
  Use for: installing/configuring the server, creating D365 AOT objects (tables, forms,
  classes, enums, EDTs, security, menu items), compiling and validating models,
  and searching the codebase through Claude Desktop.
  DB sync always requires VS2022 → Dynamics 365 → Synchronize database.
  Enforces Microsoft best practices: labeling, naming conventions, security chains,
  form pattern versions, table field groups.
  Always consult when user mentions MCP + D365, d365_object, d365_build, d365_explore,
  AI-assisted D365 development, or creating D365 objects.
  Complements d365-development (X++ code, XML templates), d365-architect, and d365-test skills.
---

# xpp-mcp — MCP Server for D365 F&O

## Table of Contents
1. [What It Does](#1-what-it-does)
2. [Installation & Configuration](#2-installation--configuration)
3. [The 3 Tools](#3-the-3-tools)
4. [Microsoft Best Practices — Enforced at Generation Time](#4-microsoft-best-practices)
5. [Object Creation Workflows](#5-object-creation-workflows)
6. [Form Creation Workflows](#6-form-creation-workflows)
7. [Menu Creation Workflows](#7-menu-creation-workflows)
8. [Security Creation Workflow](#8-security-creation-workflow)
9. [Compile & Sync Workflow](#9-compile--sync-workflow)
10. [Search & Inspection](#10-search--inspection)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What It Does

xpp-mcp is an MCP server that connects Claude Desktop (or VS Code + Claude Code) to a
D365 F&O development environment. It writes AOT XML files directly to PackagesLocalDirectory,
manages label files automatically, and wraps `xppc.exe` for headless compile and `xppbp.exe`
for best practice checks.

> **Intended environment:** Local development machines, personal VHD/VMs, or environments
> with explicit authorization. Do NOT use on production, shared, or customer environments
> without explicit approval. Always ensure work is in source control before using this tool.
> This project is not affiliated with or endorsed by Microsoft Corporation.

> **DB sync always requires VS2022.** After creating objects with this tool, always do a
> full build and database sync in VS2022 → Dynamics 365 → Synchronize database.

### Architecture
```
Claude Desktop or VS Code + Claude Code (STDIO)
        │
xpp-mcp Node.js server
        │ reads descriptors
  PackagesLocalDirectory\<Package>\Descriptor\*.xml  (UTF-16 LE, <Name> tag = model name)
        │ writes AOT XML
  PackagesLocalDirectory\<Package>\<Model>\AxType\Object.xml
        │ headless compile + BP check
  PackagesLocalDirectory\bin\xppc.exe, xppbp.exe
        │ DB sync — NOT headless
  VS2022 → Dynamics 365 → Synchronize database   (required)
```

VS2022 is not required for **object creation or compile**. It IS required for **DB sync**.
If VS2022 is open, it will detect MCP-written file changes via its file watcher automatically.

### Key Technical Facts (from live scan of D365 10.37)
- Descriptor XMLs are UTF-16 LE encoded (not UTF-8)
- Model name in descriptors uses `<Name>` tag (PascalCase)
- **`<Name>` is used for ALL name tags** — root object, child elements, method names, enum values, everything
- `<n>` (lowercase) is NEVER valid in any D365 AOT XML file
- **CRITICAL WARNING:** The Desktop Commander `read_file` tool renders `<Name>` as `<n>` in display output — files visually look correct but bytes may be wrong. Always verify with byte-level checks when debugging XML deserialization errors.
- AOT path = PackagesRoot / packageFolder / modelName / AxType / Object.xml
- packageFolder != modelName in multi-model packages (ApplicationSuite contains Foundation)
- XppMetadata/ is a compiler cache — never write to it

---

## 2. Installation & Configuration

### Build
```powershell
cd C:\xpp-mcp
npm install
node node_modules\typescript\lib\tsc.js
node build\index.js   # verify: prints loaded models
```

### config.json
```json
{
  "packagesRoot": "C:\\AOSService\\PackagesLocalDirectory",
  "defaultModel": "AA",
  "binPath":      "C:\\AOSService\\PackagesLocalDirectory\\bin",
  "defaultLocale": "en-US",
  "useLabels":    true
}
```

### Claude Desktop
Add to `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "d365-xpp": {
      "command": "node",
      "args": ["C:/xpp-mcp/build/index.js"]
    }
  }
}
```
Restart Claude Desktop. Expected startup log:
```
[xpp-mcp] Loaded 176 models (1 custom: AA)
[xpp-mcp] Server ready
```

---

## 3. The 3 Tools

### d365_object
Creates, inspects, or deletes AOT objects.

Supported types (16):
`AxTable`, `AxClass`, `AxEnum`, `AxEdt`, `AxQuery`, `AxForm`,
`AxSecurityPrivilege`, `AxSecurityDuty`, `AxSecurityRole`,
`AxMenuItemDisplay`, `AxMenuItemAction`, `AxMenuItemOutput`,
`AxMenu`, `AxMenuExtension`, `AxTableExtension`

```
action:    create | inspect | delete | list_types
type:      one of the 16 types above
model:     custom model name (e.g. "AA")
name:      object name
label:     plain text → auto-creates @AALabel:Key (when useLabels:true)
useLabels: boolean, default true
```

### d365_build
Headless compile and validation. **DB sync is not possible headlessly — see below.**
```
action:    compile | sync_db | best_practice | full_build | validate_metadata
model:     custom model name
incremental: boolean (default false)
verbose:   boolean (default false)
```

**validate_metadata** — runs `Validate-Metadata.ps1` which uses D365's own
`DataContractSerializer` DLLs to deserialize every AOT XML file, catching the
same errors VS2022 MetadataValidator surfaces (e.g. `DuplicateNamedObjectException`,
`MetadataCorruptedException`). Always run this before opening VS2022.

**full_build** runs: compile → validate_metadata (both headless), then instructs the user
to complete the sync step in VS2022 → Dynamics 365 → Synchronize database.

**sync_db** — cannot run headlessly due to two AOS service context constraints
(StaticMetadata files only generated by a full VS2022 platform build, and the DB password
is DPAPI-encrypted under the AOS service account). The tool returns a clear message
directing you to VS2022 rather than failing silently.

Build logs are written to `PackagesRoot\<Model>\xpp-mcp-logs\build-<action>-<timestamp>.log`.
The `xpp-mcp-logs\` subfolder is created automatically — keeps the model root clean.

### d365_explore
Browse and search the codebase.
```
action:         list_models | list_objects | search | read | list_types
model:          (optional) model name
type:           (optional) e.g. "AxTable"
pattern:        supports * and ? wildcards
includeStandard: boolean (default false — custom models only)
```

---

## 4. Microsoft Best Practices

THESE RULES ARE ENFORCED FOR ALL OBJECTS GENERATED BY THIS SERVER.
Always apply before creating any object.

### BP1 — Model Governance (Non-Negotiable)
- Never create objects in Microsoft standard models
- Publisher = "Microsoft Corporation" or "Microsoft" → read-only, never modify
- Custom models use layer=10 (usr)
- Always ask the user which custom model to use (e.g. AA, BB) — never assume

### BP2 — Naming Conventions
| Object | Pattern | Example |
|---|---|---|
| Table | Prefix+Entity+Table | AAOrderTable |
| Table extension | StandardTable.Prefix+Extension | CustTable.AAExtension |
| Class | Prefix+Purpose | AAOrderService |
| Class extension | StandardClass_Prefix_Extension | SalesLine_AA_Extension |
| Enum | Prefix+Name | AAOrderStatus |
| EDT | Prefix+Name | AAOrderCode |
| Form | Prefix+TableName | AAOrderTable |
| Menu item | Match form/class name | AAOrderTable |
| Menu extension | StandardMenu.Prefix | AccountsReceivable.AA |
| Security Privilege | PrefixObjectView or PrefixObjectMaintain | AAOrderTableView |
| Security Duty | PrefixViewEntity | AAViewOrders |
| Security Role | PrefixRoleName | AAOrderManager |
| Label reference | @PrefixLabel:Key | @AALabel:OrderCode |
| Label file ID | PrefixLabel | AALabel |

### BP3 — Labels Are Mandatory
- Every user-facing string must use a label — never hardcode text in AOT properties
- Applies to: table labels, field labels, form captions, menu item labels, enum value labels, security labels
- xpp-mcp: pass `label:"Order Code"` + `useLabels:true` → auto-creates `@AALabel:OrderCode`
- Label files: PackagesLocalDirectory\AA\AA\AxLabelFile\LabelResources\en-US\AALabel.en-US.label.txt

### BP4 — Security Chain Is Mandatory
Every form must have: AxSecurityPrivilege → AxSecurityDuty → AxSecurityRole
Never create a form without immediately creating its security objects.
Creation order: MenuItem → Privilege(s) → Duty → Role → MenuExtension

### BP5 — Extensibility Over Modification
- Extend standard tables via AxTableExtension (add fields only, never override behavior)
- Extend standard classes via [ExtensionOf(classStr(X))] — always call next methodName()
- Extend standard forms via AxFormExtension
- Never modify Microsoft standard objects directly

### BP6 — Table Design Rules
- Always include all 5 standard field groups: AutoReport, AutoLookup, AutoIdentification, AutoSummary, AutoBrowse
- Set PrimaryIndex to the unique business key index
- Set TitleField1 / TitleField2 for lookup and form title display
- SaveDataPerCompany=No only for truly global reference data
- CacheLookup=Found for setup/reference tables, NotInTTS for transaction tables
- TableGroup: Main (master), Transaction/WorksheetHeader (documents), Parameter (settings)

### BP7 — Form Pattern Rules
Every form must declare Pattern + PatternVersion. Correct versions (from 5,682 Foundation forms):
| Pattern | Style | PatternVersion |
|---|---|---|
| SimpleList | SimpleList | 1.1 |
| Dialog | Dialog | 1.2 |
| SimpleListDetails | SimpleListDetails | 1.3 |
| DetailsMaster | DetailsFormMaster | 1.4 |
| DetailsTransaction | DetailsFormTransaction | 1.4 |
| ListPage | ListPage | UX7 1.0 |
| TabbedWorkspace | Workspace | 1.0 |
Sub-containers must also declare their Pattern (e.g. FieldsFieldGroups v1.1 on FastTabs).

### BP8 — Form Control Naming
All form controls must use meaningful names derived from the form/table name, not system-generated
numbered names. Generic names like `FormActionPaneControl1`, `FormGroupControl1`, `FormGridControl1`,
`FormGridControl1_BookId` are never acceptable — they make the AOT unreadable and break extensibility.

| Control | Bad (never use) | Good (always use) |
|---|---|---|
| ActionPane | `FormActionPaneControl1` | `AABookTable_ActionPane` |
| Filter group | `FormGroupControl1` | `AABookTable_FilterGroup` |
| QuickFilter | `QuickFilterControl1` | `AABookTable_QuickFilter` |
| Grid | `FormGridControl1` | `AABookTable_Grid` |
| Grid column | `FormGridControl1_BookId` | `AABookTable_BookId` |
| Dialog content | `DialogContent` | `AABookConfirm_DialogContent` |
| Button group | `ButtonGroup` | `AABookConfirm_ButtonGroup` |

**Naming convention:** `<FormName>_<ControlPurpose>` — always prefix with the form name.
The xpp-mcp generator follows this convention automatically.

### BP9 — X++ Code Quality Rules (Zero BP Violations Required)
All generated X++ classes and methods must comply with these rules before check-in:

**Documentation**
- Every public class must have XML doc: `/// <summary>`, `/// <param name="_x">`, `/// <returns>`
- Every public method must have XML doc comments (triggers `BPXmlDocNoDocumentationComments`)
- Never leave XML doc stubs with no useful information (`BPXmlDocNoHelpfulInformation`)

**Naming in X++**
- Method parameters must use `_underscore` prefix: `_custAccount`, `_forUpdate` (`BPUnderscoresOnlyForParameters`)
- Local variables use camelCase (no underscore)
- Constants use UPPER_SNAKE_CASE
- Never use underscores in method names or class member names

**Query patterns**
- Always use `firstOnly` when fetching a single record (`BPErrorSelectUsingFirstOnly`)
- Never use nested `while select` loops — use joins instead
- Use `select specific fields` rather than selecting all fields

**Transactions**
- `ttsbegin/ttscommit` pairs must always be balanced (`BPErrorMethodUnbalancedTtsbeginCommit`)
- Never show dialogs or call user interaction inside `ttsbegin/ttscommit`
- Validate input BEFORE opening a transaction

**Code structure**
- Always use braces `{}` around if/while/for bodies (`BPNestedStatementsShouldBeInBraces`)
- Never leave empty methods or compound statements (`BPEmptyCompoundStatement`, `BPErrorEmptyTableMethod`)
- Never leave unused local variables (`BPLocalVariableNotUsed`) or parameters (`BPParameterNotUsed`)
- Indentation must be consistent — 4 spaces per level (`BPIndentationError`)

**Labels in X++**
- Never hardcode string literals in user-facing code — use label references (`BPErrorLabelIsText`, `BPErrorHelpIsText`)
- Label and HelpText on the same element must not be identical (`BPErrorLabelAndHelpAreEqual`)
- Never use single-quoted strings for label IDs (`BPErrorMethodLabelInSingleQuotes`)

**Table rules enforced by BP checker**
- Every table must have TitleField1 defined (`BPErrorTableTitleField1NotDeclared`)
- Every table must have a form reference (`BPErrorTableMissingFormRef`)
- Primary key fields must be mandatory (`BPErrorTablePrimaryKeyNotMandatory`)
- Primary key index must be set as AlternateKey (`BPTablePrimaryKeyIsNotAlternateKey`)
- Every field must belong to at least one field group (`BPErrorTableFieldNotInFieldGroup`)
- Table must have CacheLookup set — never leave it as None (`BPErrorTableNoCaching`)
- AutoReport field group must exist (`BPErrorTableMissingGroupAutoReport`)

### BP10 — BP Warning Suppression (When Truly Needed)
Zero BP violations is the goal. When a violation genuinely cannot be fixed (e.g. event handler
signatures require an unused parameter), suppress it explicitly rather than ignoring it.

**Method 1 — Inline attribute (preferred for single items)**
```xpp
[SuppressBPWarning('BPParameterNotUsed', 'e is mandatory for event handler interface')]
public void onChanged(FormDataSourceEventArgs _e)
{
    // _e required by interface, not used in this handler
}
```

**Method 2 — AxIgnoreDiagnosticList file (for model-wide suppressions)**
Create `PackagesLocalDirectory\AA\AA\AxIgnoreDiagnosticList\AA_BPSuppressions.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<IgnoreDiagnostics>
  <Name>AA_BPSuppressions</Name>
  <Items>
    <Diagnostic>
      <DiagnosticType>BestPractices</DiagnosticType>
      <Severity>Warning</Severity>
      <Path>dynamics://Class/AAMyClass/myMethod</Path>
      <Moniker>BPParameterNotUsed</Moniker>
      <Justification>Parameter required by event handler interface, not used in this context.</Justification>
    </Diagnostic>
  </Items>
</IgnoreDiagnostics>
```
In VS2022: right-click project → "Edit Best Practice Suppression" to open/create this file.

**Rules for suppression**
- Always provide a meaningful justification — never suppress without explanation
- Fix the real issue first; only suppress what genuinely cannot be resolved
- Never suppress `BPErrorUnknownLabel`, `BPErrorTableMissingFormRef`, or security-related BP rules
- Common legitimate suppressions: `BPParameterNotUsed` on event handlers, `BPXmlDocNoDocumentationComments` on test helper methods

### BP11 — Best Practice Check After Creation
Run `d365_build { action:"best_practice", model:"AA" }` after creating objects.
Zero BP errors required before check-in.

Most common violations from the BP report list:
| BP Rule | Cause | Fix |
|---|---|---|
| `BPErrorUnknownLabel` | Label reference doesn't exist in compiled DLL | Add label entry and rebuild labels |
| `BPErrorLabelNotDefined` | Empty or missing label property | Add label to every field, table, form |
| `BPErrorTableMissingGroupAutoReport` | AutoReport field group missing | Add AutoReport field group to table |
| `BPErrorTableTitleField1NotDeclared` | TitleField1 not set | Set TitleField1 on table |
| `BPErrorTableMissingFormRef` | No form linked to table | Create form and set FormRef on table |
| `BPErrorTableNoCaching` | CacheLookup not set | Set CacheLookup appropriate to table type |
| `BPErrorMenuItemNotCoveredByPrivilege` | MenuItem has no Privilege | Create Privilege referencing the MenuItem |
| `BPErrorPrivilegeNotCoveredByDuty` | Privilege not in any Duty | Add Privilege to a Duty |
| `BPErrorDutyNotCoveredByRole` | Duty not in any Role | Add Duty to a Role |
| `BPErrorDutyHasNoPrivileges` | Duty is empty | Add at least one Privilege to Duty |
| `BPXmlDocNoDocumentationComments` | Class/method missing XML doc | Add `/// <summary>` block |
| `BPErrorSelectUsingFirstOnly` | Single-record select without firstOnly | Add `firstonly` keyword |
| `BPUnderscoresOnlyForParameters` | Parameter not prefixed with `_` | Rename param to `_paramName` |
| `BPErrorFormDesignPatternUnspecified` | Form has no Pattern | Set Pattern + PatternVersion on Design |
| `BPErrorFormCaptionIsEmpty` | Form caption is empty | Set Caption on form Design |

### BP12 — Compile → Sync Sequence
| Change | Compile needed | DB sync needed (VS2022) |
|---|---|---|
| New class/method only | Yes | No |
| New table or field | Yes | **Yes — VS2022 Synchronize database** |
| New form/menu/security | Yes | No |
| New enum or EDT | Yes | Yes if used in a table |

---

## 5. Object Creation Workflows

### Complete Table in One Call
```json
{
  "action": "create", "type": "AxTable", "model": "AA",
  "name": "AAOrderTable", "label": "Order",
  "tableGroup": "WorksheetHeader", "cacheLookup": "NotInTTS",
  "fields": [
    { "name": "OrderCode",  "fieldType": "String", "edt": "AAOrderCode",        "label": "Order Code",  "mandatory": true },
    { "name": "OrderDate",  "fieldType": "Date",                                "label": "Order Date",  "mandatory": true },
    { "name": "Status",     "fieldType": "Enum",   "enumType": "AAOrderStatus", "label": "Status" },
    { "name": "CustomerId", "fieldType": "String",                              "label": "Customer ID" }
  ],
  "indexes": [
    { "name": "OrderCodeIdx", "fields": ["OrderCode"], "unique": true }
  ],
  "fieldGroups": [
    { "name": "AutoReport",         "fields": ["OrderCode","OrderDate","Status"] },
    { "name": "AutoLookup",         "fields": ["OrderCode","OrderDate"] },
    { "name": "AutoIdentification", "fields": ["OrderCode"] },
    { "name": "AutoSummary",        "fields": [] },
    { "name": "AutoBrowse",         "fields": [] }
  ],
  "primaryIndex": "OrderCodeIdx",
  "titleField1": "OrderCode", "titleField2": "OrderDate"
}
```

### Enum
```json
{
  "action": "create", "type": "AxEnum", "model": "AA",
  "name": "AAOrderStatus", "label": "Order Status",
  "values": [
    { "name": "Draft",     "label": "Draft",     "value": 0 },
    { "name": "Confirmed", "label": "Confirmed", "value": 1 },
    { "name": "Closed",    "label": "Closed",    "value": 2 }
  ]
}
```

### EDT
```json
{
  "action": "create", "type": "AxEdt", "model": "AA",
  "name": "AAOrderCode", "edtType": "String", "label": "Order Code", "stringSize": 20
}
```

### Class
```json
{
  "action": "create", "type": "AxClass", "model": "AA",
  "name": "AAOrderService",
  "classDeclaration": "class AAOrderService\n{\n}",
  "methods": [
    {
      "name": "find",
      "source": "    public static AAOrderTable find(AAOrderCode _code, boolean _forUpdate = false)\n    {\n        AAOrderTable t;\n        if (_forUpdate) { t.selectForUpdate(_forUpdate); }\n        select firstonly t where t.OrderCode == _code;\n        return t;\n    }"
    }
  ]
}
```

---

## 6. Form Creation Workflows

### Pattern Selection Guide
| Scenario | Pattern | PatternVersion |
|---|---|---|
| Setup/reference list | SimpleList | 1.1 |
| Setup with detail editing | SimpleListDetails | 1.3 |
| Master data (customer, vendor) | DetailsMaster | 1.4 |
| Transaction document (order) | DetailsTransaction | 1.4 |
| Quick input popup | Dialog + WindowType=Slider | 1.2 |
| Transaction list | ListPage | UX7 1.0 |

### SimpleList
```json
{
  "action": "create", "type": "AxForm", "model": "AA",
  "name": "AAOrderTable", "pattern": "SimpleList",
  "caption": "@AALabel:OrderTable",
  "dataSources": [{ "table": "AAOrderTable" }],
  "listFields": ["OrderCode", "OrderDate", "Status"]
}
```

### SimpleListDetails
```json
{
  "action": "create", "type": "AxForm", "model": "AA",
  "name": "AAOrderTable", "pattern": "SimpleListDetails",
  "caption": "@AALabel:OrderTable",
  "dataSources": [{ "table": "AAOrderTable" }],
  "listFields": ["OrderCode", "OrderDate"],
  "detailFastTabs": [
    { "caption": "@AALabel:General", "fields": ["OrderCode","OrderDate","CustomerId"] },
    { "caption": "@AALabel:Status",  "fields": ["Status"] }
  ]
}
```

### fieldTypes — Correct Control Types for Non-String Fields
**Always pass `fieldTypes` when the table has Date, Enum, Int, Real, or DateTime fields.**
Without it the generator defaults every field to `AxFormStringControl`, which fails
`validate_metadata` for enum fields and renders date fields as plain text boxes.

| Table field type | fieldTypes value | Form control emitted |
|---|---|---|
| String / EDT String | `AxTableFieldString` | `AxFormStringControl` |
| Int | `AxTableFieldInt` | `AxFormIntegerControl` |
| Int64 | `AxTableFieldInt64` | `AxFormInt64Control` |
| Real | `AxTableFieldReal` | `AxFormRealControl` |
| Date | `AxTableFieldDate` | `AxFormDateControl` |
| UtcDateTime | `AxTableFieldUtcDateTime` | `AxFormDateTimeControl` |
| **Enum** | **`AxTableFieldEnum`** | **`AxFormComboBoxControl`** ← D365 standard; `AxFormEnumControl` does NOT exist |
| Guid | `AxTableFieldGuid` | `AxFormGuidControl` |
| Time | `AxTableFieldTime` | `AxFormTimeControl` |

```json
{
  "action": "create", "type": "AxForm", "model": "AA",
  "name": "AAOrderTable", "pattern": "SimpleListDetails",
  "caption": "Orders",
  "dataSources": [{ "table": "AAOrderTable" }],
  "listFields": ["OrderCode", "OrderDate", "Status"],
  "fieldTypes": {
    "OrderCode":  "AxTableFieldString",
    "OrderDate":  "AxTableFieldDate",
    "Status":     "AxTableFieldEnum",
    "CustomerId": "AxTableFieldString"
  },
  "detailFastTabs": [
    { "caption": "General", "fields": ["OrderCode", "CustomerId"] },
    { "caption": "Dates",   "fields": ["OrderDate"] },
    { "caption": "Status",  "fields": ["Status"] }
  ]
}
```

### Dialog
```json
{
  "action": "create", "type": "AxForm", "model": "AA",
  "name": "AAOrderConfirmDialog", "pattern": "Dialog", "windowType": "Slider",
  "caption": "@AALabel:ConfirmOrder",
  "dataSources": [{ "table": "AAOrderTable" }],
  "listFields": ["OrderCode", "OrderDate"],
  "actionPaneButtons": [
    { "name": "OKButton",     "command": "OK"     },
    { "name": "CancelButton", "command": "Cancel" }
  ]
}
```

---

## 7. Menu Creation Workflows

### AxMenu — Standalone Custom Top-Level Menu
Creates a dedicated navigation module (appears in the D365 nav pane as its own module).
Use this for any custom application that needs its own top-level menu.

```json
{
  "action": "create", "type": "AxMenu", "model": "AA",
  "name": "AALibraryManagement", "label": "Library Management",
  "elements": [
    { "menuItemName": "AABookTable",   "menuItemType": "Display" },
    { "menuItemName": "AAMemberTable", "menuItemType": "Display" },
    { "menuItemName": "AALoanTable",   "menuItemType": "Display" }
  ]
}
```

**CRITICAL:** Do NOT include `<MenuItemType>` for Display items in the generated XML —
D365 treats Display as the default and including it causes `DuplicateNamedObjectException`.
Only include `menuItemType` for non-Display items (Action, Output). The generator handles this automatically.

### AxMenuExtension — Adding Items to Existing Menus

**Standard use: add menu items to an existing module**
```json
{ "action":"create", "type":"AxMenuExtension", "model":"AA",
  "name":"AccountsReceivable.AA",
  "elements":[{ "parent":"Setup", "menuItemName":"AAOrderTable", "menuItemType":"Display" }] }
```

**Adding a custom module to the D365 Main Menu (MainMenu extension)**
This makes the custom menu appear alongside standard modules (Accounts Payable, etc.)
in the D365 navigation pane. Use `menuItemType: "MenuReference"` pointing to your AxMenu.

```json
{ "action":"create", "type":"AxMenuExtension", "model":"AA",
  "name":"MainMenu.AA",
  "elements":[{ "menuItemName":"AALibraryManagement", "menuItemType":"MenuReference" }] }
```

The naming convention is `MainMenu.<ModelPrefix>` (e.g. `MainMenu.AA`, `MainMenu.BB`).
This creates an `AxMenuExtension` with `i:type="AxMenuElementMenuReference"` and `<MenuName>`
pointing to the `AxMenu` — exactly matching the D365 standard module pattern.

**Full workflow for a new module visible in Main Menu:**
```
1. Create AxMenu (standalone module)        → AALibraryManagement
2. Create AxMenuItemDisplay for each form   → AABookTable, AAMemberTable, etc.
3. Create AxMenu with all menu items        → AALibraryManagement AxMenu
4. Create MainMenu.AA AxMenuExtension       → references AALibraryManagement
5. d365_build full_build (compile + validate), then VS2022 → Dynamics 365 → Synchronize database
```

---

## 8. Security Creation Workflow

Create in this order: MenuItem → Privilege(s) → Duty → Role → MenuExtension

```json
// 1. Menu item
{ "action":"create", "type":"AxMenuItemDisplay", "model":"AA",
  "name":"AAOrderTable", "label":"@AALabel:Orders",
  "object":"AAOrderTable", "objectType":"Form" }

// 2. View privilege
{ "action":"create", "type":"AxSecurityPrivilege", "model":"AA",
  "name":"AAOrderTableView", "label":"@AALabel:ViewOrders",
  "entryPoints":[{ "menuItem":"AAOrderTable", "objectType":"MenuItemDisplay",
    "grants":{ "read":"Allow","create":"Deny","update":"Deny","delete":"Deny","correct":"Deny" },
    "forms":[{ "name":"AAOrderTable" }] }] }

// 3. Maintain privilege
{ "action":"create", "type":"AxSecurityPrivilege", "model":"AA",
  "name":"AAOrderTableMaintain", "label":"@AALabel:MaintainOrders",
  "entryPoints":[{ "menuItem":"AAOrderTable", "objectType":"MenuItemDisplay",
    "grants":{ "read":"Allow","create":"Allow","update":"Allow","delete":"Allow","correct":"Allow" },
    "forms":[{ "name":"AAOrderTable" }] }] }

// 4. Duty
{ "action":"create", "type":"AxSecurityDuty", "model":"AA",
  "name":"AAViewOrders", "label":"@AALabel:ViewOrders",
  "privileges":["AAOrderTableView"] }

// 5. Role
{ "action":"create", "type":"AxSecurityRole", "model":"AA",
  "name":"AAOrderViewer", "label":"@AALabel:OrderViewer",
  "duties":["AAViewOrders"] }

// 6. Menu extension
{ "action":"create", "type":"AxMenuExtension", "model":"AA",
  "name":"AccountsReceivable.AA",
  "elements":[{ "parent":"Setup", "menuItemName":"AAOrderTable" }] }
```

---

## 9. Compile & Sync Workflow

### Recommended workflow after creating objects

```
Step 1 — Validate XML (headless, catches DuplicateNamedObjectException before VS2022)
{ "action": "validate_metadata", "model": "AA" }

Step 2 — Compile X++ source (headless, via xppc.exe)
{ "action": "compile", "model": "AA" }

Step 3 — Best practice check (headless, via xppbp.exe)
{ "action": "best_practice", "model": "AA" }

Step 4 — Full build + sync in VS2022  ← REQUIRED, cannot be skipped
  VS2022 → Dynamics 365 → Synchronize database
```

Or use `full_build` to run steps 1–3 in one call, then complete step 4 in VS2022:
```json
{ "action": "full_build", "model": "AA" }
```

### Why VS2022 sync is required

`sync_db` cannot run headlessly due to two AOS service context constraints:
- **StaticMetadata** — SyncEngine.exe requires binary metadata files in `bin\StaticMetadata\`
  that are only generated by a full VS2022 platform build
- **DB password** — `web.config` password is DPAPI-encrypted under the AOS service account;
  cannot be decrypted by the interactive user process

Calling `sync_db` returns a clear explanation and VS2022 instructions rather than failing silently.

### What each action does

| Action | What runs | VS2022 needed? |
|---|---|---|
| `compile` | `xppc.exe` — compiles X++ source | No |
| `validate_metadata` | `DataContractSerializer` — deserializes all AOT XML | No |
| `best_practice` | `xppbp.exe` — BP rule checker | No |
| `full_build` | compile + validate_metadata, then VS2022 instructions | For sync only |
| `sync_db` | Returns VS2022 instructions | Yes |

### What requires a DB sync

| Change | Compile needed | DB sync needed |
|---|---|---|
| New class / method only | Yes | No |
| New table or field | Yes | Yes — run in VS2022 |
| New form / menu / security | Yes | No |
| New enum or EDT | Yes | Yes if used in a table |

Build logs are automatically written to:
`C:\AOSService\PackagesLocalDirectory\<Model>\xpp-mcp-logs\build-<action>-<timestamp>.log`

## 10. Search & Inspection

```json
{ "action": "list_models" }
{ "action": "list_objects", "model": "AA", "type": "AxTable" }
{ "action": "search",       "model": "AA", "pattern": "AA*", "type": "AxTable" }
{ "action": "read",         "model": "AA", "type": "AxTable", "name": "AAOrderTable" }
```

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Model not found" | Wrong model name | `d365_explore {action:"list_models"}` to see available |
| 0 models loaded | Wrong packagesRoot | Check `C:\xpp-mcp\config.json` |
| Labels not created | useLabels is false | Set `useLabels:true` in call or in config.json |
| Compile fails | xppc.exe path wrong | Check `binPath` in config.json |
| Path wrong in output XML | Multi-model package edge case | Verify with `d365_explore {action:"read", ...}` |
| `DuplicateNamedObjectException` on form | `<Name>` tag corrupted to `<name>` at byte level | Run `scripts/ByteFix-AllXml.ps1` to repair all AOT XML files at byte level |
| `DuplicateNamedObjectException` on AxMenu | `<MenuItemType>Display</MenuItemType>` present in XML | Generator omits this automatically; delete and recreate the object via MCP |
| VS2022 build errors not caught by xppc | xppc only validates IL/X++, not XML structure | Always run `validate_metadata` before opening VS2022 |
| Forms fail validate_metadata | `<Name>` tag corrupted (some file viewers hide this) | Run `scripts/ByteFix-AllXml.ps1`; verify with byte-level hex check |
| Date fields show as text boxes in form | No `fieldTypes` map passed — generator defaulted to String controls | Pass `fieldTypes` map when creating forms: `"FieldName": "AxTableFieldDate"` → emits `AxFormDateControl` |
| Server changes not taking effect after recompile | MCP server loaded old in-memory code | Restart Claude Desktop after every `npm run build` to reload the built JS |

---

## Integration with Other D365 Skills

This MCP server works standalone — no additional skills are required to create objects,
build, or explore. The following complementary skills add deeper D365 domain knowledge
to Claude if available in your account:

| Topic | Skill |
|---|---|
| X++ language, AOT XML templates, data access patterns | d365-development |
| Model/package design, security architecture, integration | d365-architect |
| Unit tests (SysTestCase), ATL, RSAT, CI/CD | d365-test |

### Typical End-to-End Workflow
1. **Design** — plan model structure, security approach, integration pattern
2. **This skill + MCP server** — create objects via d365_object, compile via d365_build
3. **VS2022** — write X++ business logic, run full sync
4. **Testing** — write SysTestCase unit tests in a dedicated test model

---

## Appendix — Implementation Notes

These notes document specific D365 behaviors discovered during development that may help
when diagnosing unexpected errors.

### AxFormComboBoxControl for Enum fields
D365 does not have an `AxFormEnumControl` type. The correct control for an Enum table field
in a form is `AxFormComboBoxControl` with `FormControlStyle=ComboBox`. Passing
`"fieldType": "AxTableFieldEnum"` in the `fieldTypes` map causes the generator to emit the
correct control type automatically. If you have existing XML files that contain
`AxFormEnumControl`, replace them with `AxFormComboBoxControl`.

### `<Name>` tag byte-level corruption
Some text editors and file-reading tools silently display `<Name>` as `<name>` (lowercase),
making corrupted XML files appear visually correct. The D365 metadata deserializer rejects
any file containing a lowercase `<name>` tag with `DuplicateNamedObjectException`.

Root cause: tools that encode `<Name>` as 3 bytes (`3C 6E 3E`) instead of 6 bytes
(`3C 4E 61 6D 65 3E`). Use `scripts/ByteFix-AllXml.ps1` to scan and repair all files in a
model at once.

### AxMenu and MenuItemType=Display
Including `<MenuItemType>Display</MenuItemType>` in an AxMenu element XML causes
`DuplicateNamedObjectException` because D365 treats Display as the default and the element
name itself already occupies that slot. The generator omits `MenuItemType` for Display
items automatically. Only `Action`, `Output`, and `MenuReference` items need an explicit
`<MenuItemType>` tag.
