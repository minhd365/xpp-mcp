# XPP-MCP — Architecture

---

## Design Principles

1. **Filesystem first** — D365 is an XML file system. Write AOT XML directly; never touch XppMetadata.
2. **Zero external dependencies for object creation** — No metadata API, no reflection, no COM, no Named Pipe.
3. **Single process** — Pure Node.js/TypeScript. `npm install` → `node build/index.js`. Done.
4. **Correct by construction** — Path resolution from descriptor XML, namespace per object type, validated templates from live scan.
5. **VS2022 for sync** — Object CRUD and compile (`xppc.exe`) run fully headlessly. DB sync requires VS2022 → Dynamics 365 → Synchronize database due to AOS service context constraints. Always finish with a VS2022 full build + sync after creating objects.
6. **3 tools, one concern each** — `d365_object`, `d365_build`, `d365_explore`.

---

## Repository Layout

```
xpp-mcp/
├── src/
│   ├── index.ts                    MCP server entry point, config load, tool registration
│   ├── config.ts                   Config schema (Zod) + validation
│   │
│   ├── core/
│   │   ├── model-registry.ts       Scans ALL descriptor XMLs → ModelInfo map
│   │   ├── aot-writer.ts           Atomic XML write (temp → rename)
│   │   ├── aot-reader.ts           Read + parse existing AOT XML files
│   │   └── label-manager.ts        AxLabelFile descriptor + .label.txt management
│   │
│   ├── schemas/
│   │   ├── types.ts                Shared TypeScript interfaces
│   │   ├── namespaces.ts           XML namespace map per object type (ground truth from live scan)
│   │   ├── ax-table.ts             AxTable generator
│   │   ├── ax-class-enum-edt-query.ts  AxClass, AxEnum, AxEdt, AxQuery generators
│   │   ├── ax-form.ts              AxForm generator — 4 tiers, 35 patterns
│   │   ├── ax-security-menu.ts     AxSecurityPrivilege/Duty/Role, AxMenuItem*, AxMenuExtension, AxTableExtension
│   │   └── registry.ts             Maps object type name → schema handler
│   │
│   ├── tools/
│   │   ├── object-tool.ts          d365_object handler
│   │   ├── build-tool.ts           d365_build handler
│   │   └── explore-tool.ts         d365_explore handler
│   │
│   └── build/                      (reserved for future wrappers)
│
├── scripts/
│   ├── ByteFix-AllXml.ps1          Byte-level repair of <Name> tag encoding in AOT XML files
│   ├── Validate-Metadata.ps1       D365 DataContractSerializer deserialization check
│   ├── Fix-HtmlEntities.ps1        Fix HTML entities (&lt; &gt; etc.) inside CDATA blocks
│   └── Scan-Cdata.ps1              Scan AOT XML files for broken CDATA content
│
├── docs/
│   ├── ARCHITECTURE.md             This file
│   ├── CLAUDE-DESKTOP-CONFIG.md    Claude Desktop setup + usage examples
│   ├── VSCODE-CONFIG.md            VS Code + Claude Code extension setup
│   └── SKILL-xpp-mcp.md      Claude skill file (import into your Claude account)
│
├── config.example.json             Template — copy to config.json and fill in your paths
├── package.json
├── tsconfig.json
├── Start-MD365XppMcp.ps1           PowerShell launcher (foreground + scheduled task)
├── start.bat                       Simple double-click launcher
└── README.md
```

---

## Key Technical Findings (from live filesystem scan)

These were discovered by scanning `PackagesLocalDirectory` directly:

### Descriptor XML encoding
All D365 descriptor XMLs are **UTF-16 LE** encoded, not UTF-8.
`readFileSync('utf-8')` returns garbage. Must detect and decode:
```typescript
if (buf[1] === 0x00 && buf[3] === 0x00) return buf.toString('utf16le');
```

### Descriptor tag name
The model name in descriptor XMLs is `<Name>` (PascalCase).
**`<Name>` is used for ALL name tags everywhere in D365 AOT XML** — root object names,
child element names, method names, enum value names, everything. There is no `<name>` (lowercase)
anywhere in valid D365 AOT XML.

### AOT path formula
```
PackagesRoot / packageFolder / modelName / AxType / ObjectName.xml
```
`packageFolder` and `modelName` are **NOT** always the same.
Multi-model packages exist:
- `ApplicationSuite` package → `Foundation` model (inner folder)
- `Directory` package → `Directory` or `SecurityReports` models
Always resolve from `<n>` in the descriptor, not from the folder name.

### XML namespace groups (confirmed from 100k+ objects)
```
Group A (xmlns:i only):     AxTable, AxClass, AxEnum, AxSecurityPrivilege/Duty/Role, AxTableExtension
Group B (xmlns:i + xmlns=""): AxEdt (i:type=AxEdtString etc), AxQuery (i:type=AxQuerySimple)
Group C (V1 namespace):     AxMenuItemDisplay/Action/Output, AxMenu, AxMenuExtension
Group D (V6 namespace):     AxForm, AxFormExtension
```

### Form patterns (confirmed from 5,682 Foundation forms)
Top patterns by frequency with correct version numbers:
```
SimpleList               → Style=SimpleList            PatternVersion=1.1   (1,217 forms)
Dialog                   → Style=Dialog                PatternVersion=1.2   (620 forms)
SimpleListDetails        → Style=SimpleListDetails     PatternVersion=1.3   (564 forms)
DetailsMaster            → Style=DetailsFormMaster     PatternVersion=1.4   (118 forms)
DetailsTransaction       → Style=DetailsFormTransaction PatternVersion=1.4  (72 forms)
ListPage                 → Style=ListPage              PatternVersion=UX7 1.0 (126 forms)
```

### AOT folder casing
Some standard model folders use lowercase on disk (`axsecurityduty`, `axsecurityrole`).
Windows is case-insensitive for reads, but always CREATE new folders with canonical Pascal case.

---

## Core Components

### ModelRegistry

Scans all descriptor XMLs at startup (~50ms for 176 models).
Handles UTF-16 LE decoding and `<n>` tag extraction.
Exposes `getAotPath(modelName, objectType, objectName)` using the correct inner folder name.

### AotWriter

Atomic write using temp-file → rename pattern.
Creates directory tree if missing.
Never writes to `XppMetadata/` — that is a compiler cache.

### LabelManager

Two-file label system:
1. `AxLabelFile/<LabelFileId>_<locale>.xml` — descriptor
2. `AxLabelFile/LabelResources/<locale>/<LabelFileId>.<locale>.label.txt` — key=value pairs

When `useLabels: true` and you pass `label: "Order Code"`:
- Derives key from field name → `@MMLabel:OrderCode`
- Upserts both files atomically
- Returns the label reference for embedding in object XML

### Schema Registry

16 object types registered, dispatched by type name string.
Each handler is a pure function `(spec) => string` (XML output).
No side effects — XML generation is completely separate from file writing.

### Form Generator (4 tiers)

```
Tier 1 — Dialog/DropDialog:         Full XML ~80 lines
Tier 2 — SimpleList/LookupGridOnly: Full XML ~120 lines
Tier 3 — SimpleListDetails:         Full XML ~200 lines
Tier 4 — All other patterns:        Valid skeleton with datasources; complete in VS2022
```

---

## Tool API

### d365_object

```
action:  create | inspect | delete | list_types
type:    AxTable | AxClass | AxEnum | AxEdt | AxQuery | AxForm |
         AxSecurityPrivilege | AxSecurityDuty | AxSecurityRole |
         AxMenuItemDisplay | AxMenuItemAction | AxMenuItemOutput |
         AxMenu | AxMenuExtension | AxTableExtension
model:   string   (custom model name, e.g. "AA")
name:    string
label:   string   (plain text — auto-creates label entry if useLabels:true)
useLabels: boolean (default true)
+ type-specific fields (see CLAUDE-DESKTOP-CONFIG.md for full examples)
```

**AxMenu** — standalone top-level navigation module. Elements use `menuItemType: "Display"`
(omitted in XML — generator handles this automatically to avoid DuplicateNamedObjectException).

**AxMenuExtension with MenuReference** — use `menuItemType: "MenuReference"` to add an AxMenu
to the D365 main navigation. Convention: name as `MainMenu.<ModelPrefix>` (e.g. `MainMenu.MM`).

### d365_build — validate_metadata

Runs `scripts/Validate-Metadata.ps1` using D365's own `DataContractSerializer` DLLs
(`Microsoft.Dynamics.AX.Metadata.Storage.dll`) to deserialize every AOT XML file —
exactly what VS2022's MetadataValidator does. Catches `DuplicateNamedObjectException`
and `MetadataCorruptedException` before VS2022 is opened.

`full_build` runs: **compile → validate_metadata** (headless), then prompts the user to run
**Dynamics 365 → Synchronize database** in VS2022 to complete the sync step.
Build logs written to: `PackagesRoot\<Model>\xpp-mcp-logs\build-<action>-<timestamp>.log`

### d365_build — Known Limitation: sync_db
Two hard blockers exist by design — both require the AOS service process context:

**Blocker 1 — StaticMetadata missing**
SyncEngine.exe reads compiled binary metadata from `bin\StaticMetadata\`.
These `.md` files (e.g. `AxView.md`, `AxTable.md`) are only generated during a
**full VS2022 platform build** of the entire D365 runtime. Running `xppc.exe`
alone (what `d365_build compile` does) only compiles your model's X++ source —
it does not generate StaticMetadata. Without these files, SyncEngine exits with:
```
MetadataReadMissingFileException: StaticMetadata\AxView.md does not exist
```

**Blocker 2 — Password encrypted under the AOS service account**
The `DataAccess.SqlPwd` value in `C:\AOSService\webroot\web.config` is encrypted
using Windows DPAPI with `DataProtectionScope.LocalMachine`, scoped to the
identity of the AOS Windows service account (typically `NT AUTHORITY\NETWORK SERVICE`
or a dedicated service account). DPAPI `Unprotect` only succeeds when called by
the **same Windows identity** that performed the encryption. Any process running
as the interactive user (including our Node.js server) receives "The data is
invalid" and cannot obtain the plaintext password.

**Correct way to sync the database:**
```
VS2022 → Dynamics 365 → Synchronize database
```
VS2022's sync command runs SyncEngine inside the correct service context with
access to both StaticMetadata and the decrypted connection string.

**When sync_db is called**, the tool returns a clear message explaining this
limitation and directing the user to VS2022, rather than failing silently.

### d365_explore

```
action:  list_models | list_objects | search | read | list_types
model:   string (optional)
type:    string (optional, e.g. "AxTable")
pattern: string (supports * and ? wildcards)
name:    string
includeStandard: boolean (default false — custom models only)
```

---

## Data Flow

```
Claude Desktop
    │ STDIO
    ▼
MCP Server (index.ts)  ←  config.json
    │
    ├── d365_object ──► SchemaRegistry → generate XML
    │                        │
    │                   ModelRegistry → resolve path
    │                        │
    │                   LabelManager → upsert labels
    │                        │
    │                   AotWriter → atomic write to AOT path
    │
    ├── d365_build  ──► spawn xppc.exe / xppbp.exe (compile + BP check)
    │                   sync_db → directs user to VS2022 (cannot run headlessly)
    │
    └── d365_explore ──► fs.readdirSync on AOT folders → results


PackagesLocalDirectory\
  <PackageFolder>\<ModelName>\AxTable\Object.xml   ← write here
  <PackageFolder>\XppMetadata\                      ← never touch
  bin\xppc.exe, SyncEngine.exe, xppbp.exe           ← execute only
```

---

## Common BP Rules Reference

The following BP rules are enforced by the D365 compiler and best practice checker.
Source: D365 F&O BP report + Microsoft documentation.
Target: **zero violations** before every check-in.

### Form BP Rules
| Rule | Description |
|---|---|
| `BPErrorFormDesignPatternUnspecified` | Form Design has no Pattern set — set Pattern + PatternVersion |
| `BPErrorFormControlPatternUnspecified` | A form container has no Pattern — set Pattern on sub-container |
| `BPErrorFormCaptionIsEmpty` | Form Design caption is empty — set label reference |
| `BPErrorCaptionNotDefined` | Caption property not set on control |
| `BPErrorCustomFilterGroupInputControlUnbound` | QuickFilter not wired to grid — set targetControlName |

### Security Chain BP Rules
| Rule | Description |
|---|---|
| `BPErrorMenuItemNotCoveredByPrivilege` | MenuItem has no Privilege referencing it |
| `BPErrorPrivilegeNotCoveredByDuty` | Privilege not assigned to any Duty |
| `BPErrorDutyNotCoveredByRole` | Duty not assigned to any Role |
| `BPErrorDutyHasNoPrivileges` | Duty has no Privileges — add at least one |
| `BPErrorPreventDenyGrant` | Grant uses Deny — use Unset where Deny is not required |
| `BPErrorPreventRedundantUnsetGrant` | Entry point has redundant Unset grant |

### Label BP Rules
| Rule | Description |
|---|---|
| `BPErrorUnknownLabel` | Label reference not found in compiled DLL — add and rebuild |
| `BPErrorLabelIsText` | Hardcoded string instead of label reference |
| `BPErrorLabelNotDefined` | Label property is empty — assign a label |
| `BPErrorLabelWrongEndSign` | Label text ends with wrong punctuation |
| `BPErrorLabelAndHelpAreEqual` | Label and HelpText identical — HelpText must add context |
| `BPErrorHelpIsText` | HelpText is a hardcoded string instead of label |

### Table BP Rules
| Rule | Description |
|---|---|
| `BPErrorTableMissingGroupAutoReport` | AutoReport field group missing — always include all 5 standard groups |
| `BPErrorTableTitleField1NotDeclared` | TitleField1 not set |
| `BPErrorTableTitleField2NotDeclared` | TitleField2 not set |
| `BPErrorTableMissingFormRef` | No form reference on table — create form and set FormRef |
| `BPErrorTableNoCaching` | CacheLookup not set — always set appropriate value |
| `BPTablePrimaryKeyIsNotAlternateKey` | Primary key index not marked as AlternateKey=Yes |
| `BPErrorTablePrimaryKeyNotMandatory` | Primary key field is not mandatory |
| `BPErrorTableFieldNotInFieldGroup` | Field not in any field group |

### X++ Code Quality BP Rules
| Rule | Description |
|---|---|
| `BPXmlDocNoDocumentationComments` | Public class/method missing `/// <summary>` block |
| `BPXmlDocNoSummaryTag` | XML doc missing `<summary>` tag |
| `BPXmlDocNoReturns` | Non-void method missing `<returns>` tag |
| `BPXmlDocParameterNotDescribed` | Parameter not documented |
| `BPErrorSelectUsingFirstOnly` | Single-record select missing `firstonly` keyword |
| `BPUnderscoresOnlyForParameters` | Method parameter not using `_underscore` prefix |
| `BPLocalVariableNotUsed` | Declared variable never used |
| `BPParameterNotUsed` | Method parameter never used |
| `BPNestedStatementsShouldBeInBraces` | if/while/for body missing `{}` braces |
| `BPIndentationError` | Indentation doesn't match D365 standards (4 spaces per level) |
| `BPEmptyCompoundStatement` | Empty `{}` block in code |
| `BPErrorEmptyTableMethod` | Empty override method on table |
| `BPErrorMethodUnbalancedTtsbeginCommit` | ttsbegin/ttscommit not balanced |
| `BPErrorMethodLabelInSingleQuotes` | Label ID referenced with single quotes |

### BP Suppression
When a violation genuinely cannot be fixed:

**Inline (single method):**
```xpp
[SuppressBPWarning('BPParameterNotUsed', 'Required by event handler interface')]
public void onChanged(FormDataSourceEventArgs _e) { }
```

**Model-wide (AxIgnoreDiagnosticList file):**
Path: `PackagesLocalDirectory\<Model>\<Model>\AxIgnoreDiagnosticList\<Model>_BPSuppressions.xml`
VS2022: right-click project → "Edit Best Practice Suppression"

**Never suppress:** `BPErrorUnknownLabel`, `BPErrorTableMissingFormRef`, any security chain rules.

---

## Appendix — Developer Notes

### read_file tools and `<Name>` tag rendering

Some file-reading tools (e.g. Desktop Commander `read_file`) silently render `<Name>` as `<name>` in
their display output. Files that appear correct in text view may have wrong bytes on disk
(`3C 6E 61 6D 65 3E` vs `3C 4E 61 6D 65 3E`). This causes `DuplicateNamedObjectException` or
`MetadataCorruptedException` when D365 deserializes the XML.

**Diagnosis:** Use `scripts/ByteFix-AllXml.ps1` to detect and repair all AOT XML files in a model at once.

Always verify with byte-level checks when debugging deserialization errors. The byte pattern for a
corrupted `<name>` tag is `3C 6E 3E` (3 bytes) instead of `3C 4E 61 6D 65 3E` (6 bytes for `<Name>`).
