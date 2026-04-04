// ============================================================
// AxSecurityPrivilege, AxSecurityDuty, AxSecurityRole
// AxMenuItemDisplay/Action/Output, AxMenuExtension
// All confirmed from live Foundation scan
// ============================================================
import type { EntryPointDef, MenuExtensionElementDef } from './types.js';

// ── AxSecurityPrivilege ──────────────────────────────────────────────────────

export interface AxPrivilegeSpec {
  name: string;
  label?: string;
  entryPoints?: EntryPointDef[];
}

export function generatePrivilege(spec: AxPrivilegeSpec): string {
  const labelLine = spec.label ? `\t<Label>${spec.label}</Label>\n` : '';
  const eps = (spec.entryPoints ?? []).map(generateEntryPoint).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxSecurityPrivilege xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>${spec.name}</Name>
${labelLine}\t<DataEntityPermissions />
\t<DirectAccessPermissions />
\t<EntryPoints>
${eps}
\t</EntryPoints>
\t<FormControlOverrides />
</AxSecurityPrivilege>
`;
}

function generateEntryPoint(ep: EntryPointDef): string {
  const g = ep.grants ?? {};
  const objType = ep.objectType ?? 'MenuItemDisplay';
  const forms = (ep.forms ?? []).map(f =>
    `\t\t\t\t<AxSecurityEntryPointReferenceForm>\n\t\t\t\t\t<Name>${f.name}</Name>\n\t\t\t\t\t<Controls />\n\t\t\t\t\t<DataSources />\n\t\t\t\t</AxSecurityEntryPointReferenceForm>`
  ).join('\n');

  return `\t\t<AxSecurityEntryPointReference>
\t\t\t<Name>${ep.menuItem}</Name>
\t\t\t<Grant>
\t\t\t\t<Correct>${g.correct ?? 'Allow'}</Correct>
\t\t\t\t<Create>${g.create ?? 'Allow'}</Create>
\t\t\t\t<Delete>${g.delete ?? 'Allow'}</Delete>
\t\t\t\t<Read>${g.read ?? 'Allow'}</Read>
\t\t\t\t<Update>${g.update ?? 'Allow'}</Update>
\t\t\t</Grant>
\t\t\t<ObjectName>${ep.menuItem}</ObjectName>
\t\t\t<ObjectType>${objType}</ObjectType>
\t\t\t<Forms>
${forms}
\t\t\t</Forms>
\t\t</AxSecurityEntryPointReference>`;
}

// ── AxSecurityDuty ───────────────────────────────────────────────────────────

export interface AxDutySpec {
  name: string;
  label?: string;
  privileges?: string[];
}

export function generateDuty(spec: AxDutySpec): string {
  const labelLine = spec.label ? `\t<Label>${spec.label}</Label>\n` : '';
  const privs = (spec.privileges ?? []).map(p =>
    `\t\t<AxSecurityPrivilegeReference>\n\t\t\t<Name>${p}</Name>\n\t\t</AxSecurityPrivilegeReference>`
  ).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxSecurityDuty xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>${spec.name}</Name>
${labelLine}\t<Privileges>
${privs}
\t</Privileges>
</AxSecurityDuty>
`;
}

// ── AxSecurityRole ───────────────────────────────────────────────────────────

export interface AxRoleSpec {
  name: string;
  label?: string;
  description?: string;
  duties?: string[];
  privileges?: string[];
}

export function generateRole(spec: AxRoleSpec): string {
  const labelLine = spec.label ? `\t<Label>${spec.label}</Label>\n` : '';
  const descLine  = spec.description ? `\t<Description>${spec.description}</Description>\n` : '';
  const duties = (spec.duties ?? []).map(d =>
    `\t\t<AxSecurityDutyReference>\n\t\t\t<Name>${d}</Name>\n\t\t</AxSecurityDutyReference>`
  ).join('\n');
  const privs = (spec.privileges ?? []).map(p =>
    `\t\t<AxSecurityPrivilegeReference>\n\t\t\t<Name>${p}</Name>\n\t\t</AxSecurityPrivilegeReference>`
  ).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxSecurityRole xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>${spec.name}</Name>
${descLine}${labelLine}\t<DirectAccessPermissions />
\t<Duties>
${duties}
\t</Duties>
\t<Privileges>
${privs}
\t</Privileges>
\t<SubRoles />
</AxSecurityRole>
`;
}

// ── AxMenuItemDisplay / Action / Output ──────────────────────────────────────

export type MenuItemKind = 'Display' | 'Action' | 'Output';

export interface AxMenuItemSpec {
  name: string;
  kind?: MenuItemKind;
  label?: string;
  object?: string;       // form/class/report name
  objectType?: string;   // Form, Class, Report
  parameters?: string;   // Args.parm() value passed to main() — e.g. 'SendOne', 'SendSelected'
  helpText?: string;
}

export function generateMenuItem(spec: AxMenuItemSpec): string {
  const kind = spec.kind ?? 'Display';
  const rootTag = kind === 'Display' ? 'AxMenuItemDisplay'
                : kind === 'Action'  ? 'AxMenuItemAction'
                :                      'AxMenuItemOutput';

  const labelLine  = spec.label      ? `\t<Label>${spec.label}</Label>\n`           : '';
  const helpLine   = spec.helpText   ? `\t<HelpText>${spec.helpText}</HelpText>\n`   : '';
  const objLine    = spec.object     ? `\t<Object>${spec.object}</Object>\n`         : '';
  const paramsLine = spec.parameters ? `\t<Parameters>${spec.parameters}</Parameters>\n` : '';
  const objType    = spec.objectType ?? 'Form';

  return `<?xml version="1.0" encoding="utf-8"?>
<${rootTag} xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V1">
\t<Name>${spec.name}</Name>
${labelLine}${helpLine}${objLine}\t<ObjectType>${objType}</ObjectType>
${paramsLine}</${rootTag}>
`;
}

// ── AxMenu (standalone custom top-level menu) ────────────────────────────────

export interface AxMenuSpec {
  name: string;
  label?: string;
  menuItems?: Array<{ name: string; menuItemType?: string }>;
}

export function generateMenu(spec: AxMenuSpec): string {
  const labelLine = spec.label ? `\t<Label>${spec.label}</Label>\n` : '';
  const elements = (spec.menuItems ?? []).map(el => {
    const miType = el.menuItemType ?? 'Display';
    // Only emit <MenuItemType> for non-Display items — D365 treats Display as default
    // and including it on Display items causes DuplicateNamedObjectException
    const miTypeLine = miType !== 'Display' ? `\n\t\t\t<MenuItemType>${miType}</MenuItemType>` : '';
    return `\t\t<AxMenuElement xmlns=""\n\t\t\ti:type="AxMenuElementMenuItem">\n\t\t\t<Name>${el.name}</Name>\n\t\t\t<MenuItemName>${el.name}</MenuItemName>${miTypeLine}\n\t\t</AxMenuElement>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxMenu xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V1">
\t<Name>${spec.name}</Name>
${labelLine}\t<Elements>
${elements}
\t</Elements>
</AxMenu>
`;
}

// ── AxMenuExtension ──────────────────────────────────────────────────────────

export interface AxMenuExtensionSpec {
  name: string;          // e.g. "AccountsReceivable.BB"
  elements?: MenuExtensionElementDef[];
}

export function generateMenuExtension(spec: AxMenuExtensionSpec): string {
  const elements = (spec.elements ?? []).map(el => {
    // Support both MenuReference (for top-level module refs) and MenuItem
    if (el.menuItemType === 'MenuReference') {
      return `\t\t<AxMenuExtensionElement xmlns="">
\t\t\t<MenuElement xmlns=""
\t\t\t\ti:type="AxMenuElementMenuReference">
\t\t\t\t<Name>${el.menuItemName}</Name>
\t\t\t\t<MenuName>${el.menuItemName}</MenuName>
\t\t\t</MenuElement>
\t\t</AxMenuExtensionElement>`;
    }
    const miType = el.menuItemType ?? 'Display';
    return `\t\t<AxMenuExtensionElement xmlns="">
\t\t\t<Parent>${el.parent}</Parent>
\t\t\t<MenuElement xmlns=""
\t\t\t\ti:type="AxMenuElementMenuItem">
\t\t\t\t<Name>${el.menuItemName}</Name>
\t\t\t\t<MenuItemName>${el.menuItemName}</MenuItemName>
\t\t\t\t<MenuItemType>${miType}</MenuItemType>
\t\t\t</MenuElement>
\t\t</AxMenuExtensionElement>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxMenuExtension xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V1">
\t<Name>${spec.name}</Name>
\t<Customizations />
\t<Elements>
${elements}
\t</Elements>
\t<MenuElementModifications />
\t<PropertyModifications />
</AxMenuExtension>
`;
}

// ── AxTableExtension ─────────────────────────────────────────────────────────

import type { FieldDef, RelationDef, FieldGroupDef } from './types.js';

export interface AxTableExtensionSpec {
  name: string;          // e.g. "CustTable.BBExtension"
  fields?: FieldDef[];
  fieldGroups?: FieldGroupDef[];
  relations?: RelationDef[];
  indexes?: Array<{ name: string; fields: string[]; unique?: boolean }>;
}

export function generateTableExtension(spec: AxTableExtensionSpec): string {
  const fields = (spec.fields ?? []).map(f => {
    const typeMap: Record<string, string> = {
      String: 'AxTableFieldString', Int: 'AxTableFieldInt', Int64: 'AxTableFieldInt64',
      Real: 'AxTableFieldReal', Date: 'AxTableFieldDate', DateTime: 'AxTableFieldUtcDateTime',
      Enum: 'AxTableFieldEnum', Guid: 'AxTableFieldGuid', Container: 'AxTableFieldContainer',
    };
    const itype = typeMap[f.fieldType] ?? 'AxTableFieldString';
    const label = f.label ? `\n\t\t\t<Label>${f.label}</Label>` : '';
    const edt   = f.edt   ? `\n\t\t\t<ExtendedDataType>${f.edt}</ExtendedDataType>` : '';
    return `\t\t<AxTableField xmlns=""\n\t\t\ti:type="${itype}">\n\t\t\t<Name>${f.name}</Name>${label}${edt}\n\t\t</AxTableField>`;
  }).join('\n');

  const fieldGroups = (spec.fieldGroups ?? []).map(fg => {
    const flds = fg.fields.map(f =>
      `\t\t\t\t<AxTableFieldGroupField>\n\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t</AxTableFieldGroupField>`
    ).join('\n');
    return `\t\t<AxTableFieldGroup>\n\t\t\t<Name>${fg.name}</Name>\n\t\t\t<Fields>\n${flds}\n\t\t\t</Fields>\n\t\t</AxTableFieldGroup>`;
  }).join('\n');

  const relations = (spec.relations ?? []).map(rel => {
    const constraints = rel.constraints.map(c =>
      `\t\t\t\t<AxTableRelationConstraint xmlns="" i:type="AxTableRelationConstraintField">\n\t\t\t\t\t<Name>${c.field}</Name>\n\t\t\t\t\t<Field>${c.field}</Field>\n\t\t\t\t\t<RelatedField>${c.relatedField}</RelatedField>\n\t\t\t\t</AxTableRelationConstraint>`
    ).join('\n');
    return `\t\t<AxTableRelation>\n\t\t\t<Name>${rel.name}</Name>\n\t\t\t<RelatedTable>${rel.relatedTable}</RelatedTable>\n\t\t\t<Constraints>\n${constraints}\n\t\t\t</Constraints>\n\t\t</AxTableRelation>`;
  }).join('\n');

  const indexes = (spec.indexes ?? []).map(idx => {
    const flds = idx.fields.map(f =>
      `\t\t\t\t<AxTableIndexField>\n\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t</AxTableIndexField>`
    ).join('\n');
    const altKey = idx.unique ? '\n\t\t\t<AlternateKey>Yes</AlternateKey>' : '';
    return `\t\t<AxTableIndex>\n\t\t\t<Name>${idx.name}</Name>${altKey}\n\t\t\t<Fields>\n${flds}\n\t\t\t</Fields>\n\t\t</AxTableIndex>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxTableExtension xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>${spec.name}</Name>
\t<FieldGroupExtensions />
\t<FieldGroups>
${fieldGroups}
\t</FieldGroups>
\t<Fields>
${fields}
\t</Fields>
\t<Indexes>
${indexes}
\t</Indexes>
\t<Relations>
${relations}
\t</Relations>
</AxTableExtension>
`;
}
