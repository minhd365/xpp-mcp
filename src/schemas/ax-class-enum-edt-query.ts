// ============================================================
// AxClass, AxEnum, AxEdt, AxQuery generators
// ============================================================
import type { MethodDef, EnumValueDef, EdtType } from './types.js';

// ── AxClass ──────────────────────────────────────────────────────────────────

export interface AxClassSpec {
  name: string;
  extends?: string;
  declaration?: string; // custom class body (member vars, attributes)
  methods?: MethodDef[];
}

export function generateClass(spec: AxClassSpec): string {
  const classDecl = spec.declaration
    ?? (spec.extends
      ? `class ${spec.name} extends ${spec.extends}\n{\n}`
      : `class ${spec.name}\n{\n}`);

  const methods = (spec.methods ?? []).map(generateMethod).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxClass xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>${spec.name}</Name>
\t<SourceCode>
\t\t<Declaration><![CDATA[
${classDecl}
]]></Declaration>
\t\t<Methods>
${methods}
\t\t</Methods>
\t</SourceCode>
</AxClass>
`;
}

// ── AxEnum ───────────────────────────────────────────────────────────────────

export interface AxEnumSpec {
  name: string;
  label?: string;
  helpText?: string;
  values: EnumValueDef[];
}

export function generateEnum(spec: AxEnumSpec): string {
  const values = spec.values.map(v => `\t\t<AxEnumValue>
\t\t\t<Name>${v.name}</Name>
${v.label ? `\t\t\t<Label>${v.label}</Label>\n` : ''}\t\t\t<Value>${v.value}</Value>
\t\t</AxEnumValue>`).join('\n');

  const labelLine = spec.label ? `\t<Label>${spec.label}</Label>\n` : '';
  const helpLine  = spec.helpText ? `\t<HelpText>${spec.helpText}</HelpText>\n` : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<AxEnum xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
\t<Name>${spec.name}</Name>
${labelLine}${helpLine}\t<EnumValues>
${values}
\t</EnumValues>
</AxEnum>
`;
}

// ── AxEdt ────────────────────────────────────────────────────────────────────

const EDT_ITYPE_MAP: Record<EdtType, string> = {
  String: 'AxEdtString', Int: 'AxEdtInt', Int64: 'AxEdtInt64',
  Real: 'AxEdtReal', Date: 'AxEdtDate', DateTime: 'AxEdtUtcDateTime',
  Enum: 'AxEdtEnum', Guid: 'AxEdtGuid', Container: 'AxEdtContainer',
  Time: 'AxEdtTime',
};

export interface AxEdtSpec {
  name: string;
  edtType: EdtType;
  label?: string;
  helpText?: string;
  extends?: string;
  enumType?: string;     // for edtType=Enum
  stringSize?: number;   // for edtType=String
  referenceTable?: string; // for Int64 FK
  countryRegionCodes?: string;
}

export function generateEdt(spec: AxEdtSpec): string {
  const itype = EDT_ITYPE_MAP[spec.edtType] ?? 'AxEdtString';

  const lines: string[] = [];
  if (spec.countryRegionCodes)
    lines.push(`\t<CountryRegionCodes>${spec.countryRegionCodes}</CountryRegionCodes>`);
  if (spec.extends) lines.push(`\t<Extends>${spec.extends}</Extends>`);
  if (spec.helpText) lines.push(`\t<HelpText>${spec.helpText}</HelpText>`);
  if (spec.label) lines.push(`\t<Label>${spec.label}</Label>`);
  if (spec.referenceTable)
    lines.push(`\t<ReferenceTable>${spec.referenceTable}</ReferenceTable>`);

  // Type-specific extras
  if (spec.edtType === 'Enum' && spec.enumType)
    lines.push(`\t<EnumType>${spec.enumType}</EnumType>`);
  if (spec.edtType === 'String' && spec.stringSize)
    lines.push(`\t<StringSize>${spec.stringSize}</StringSize>`);
  if (spec.edtType === 'Date')
    lines.push(`\t<DateDay>None</DateDay>`);
  if (spec.edtType === 'DateTime')
    lines.push(`\t<ButtonImage>Calendar</ButtonImage>`);

  return `<?xml version="1.0" encoding="utf-8"?>
<AxEdt xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns=""
\ti:type="${itype}">
\t<Name>${spec.name}</Name>
${lines.join('\n')}
\t<ArrayElements />
\t<Relations />
\t<TableReferences />
</AxEdt>
`;
}

// ── AxQuery ──────────────────────────────────────────────────────────────────

export interface QueryDataSourceSpec {
  name: string;
  table: string;
  dynamicFields?: boolean;
  update?: boolean;
  ranges?: Array<{ field: string; value?: string }>;
  orderBy?: Array<{ field: string; direction?: 'Ascending' | 'Descending' }>;
}

export interface AxQuerySpec {
  name: string;
  dataSources?: QueryDataSourceSpec[];
  methods?: MethodDef[];
}

export function generateQuery(spec: AxQuerySpec): string {
  const methods = (spec.methods ?? []).map(generateMethod).join('\n');
  const ds = (spec.dataSources ?? []).map(generateQueryDs).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<AxQuery xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns=""
\ti:type="AxQuerySimple">
\t<Name>${spec.name}</Name>
\t<SourceCode>
\t\t<Methods>
\t\t\t<Method>
\t\t\t\t<Name>classDeclaration</Name>
\t\t\t\t<Source><![CDATA[
[Query]
public class ${spec.name} extends QueryRun
{
}
]]></Source>
\t\t\t</Method>
${methods}
\t\t</Methods>
\t</SourceCode>
\t<DataSources>
${ds}
\t</DataSources>
</AxQuery>
`;
}

function generateQueryDs(ds: QueryDataSourceSpec): string {
  const dynFields = ds.dynamicFields !== false ? 'Yes' : 'No';
  const update = ds.update !== false ? 'Yes' : 'No';

  const ranges = (ds.ranges ?? []).map(r =>
    `\t\t\t<AxQuerySimpleDataSourceRange>\n\t\t\t\t<Name>${r.field}</Name>\n\t\t\t\t<Field>${r.field}</Field>\n${r.value ? `\t\t\t\t<Value>${r.value}</Value>\n` : ''}\t\t\t</AxQuerySimpleDataSourceRange>`
  ).join('\n');

  const orderBy = (ds.orderBy ?? []).map(o =>
    `\t\t\t<AxQuerySimpleOrderByField>\n\t\t\t\t<Name>${o.field}</Name>\n\t\t\t\t<Field>${o.field}</Field>\n\t\t\t\t<Direction>${o.direction ?? 'Ascending'}</Direction>\n\t\t\t</AxQuerySimpleOrderByField>`
  ).join('\n');

  return `\t\t<AxQuerySimpleRootDataSource>
\t\t\t<Name>${ds.name}</Name>
\t\t\t<DynamicFields>${dynFields}</DynamicFields>
\t\t\t<Table>${ds.table}</Table>
\t\t\t<Update>${update}</Update>
\t\t\t<DataSources />
\t\t\t<Fields />
\t\t\t<Ranges>
${ranges}
\t\t\t</Ranges>
\t\t\t<GroupBy />
\t\t\t<Having />
\t\t\t<OrderBy>
${orderBy}
\t\t\t</OrderBy>
\t\t</AxQuerySimpleRootDataSource>`;
}

// ── Shared method generator ──────────────────────────────────────────────────

function generateMethod(m: MethodDef): string {
  return `\t\t\t<Method>
\t\t\t\t<Name>${m.name}</Name>
\t\t\t\t<Source><![CDATA[
${m.source}
]]></Source>
\t\t\t</Method>`;
}
