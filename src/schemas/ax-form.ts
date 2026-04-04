// ============================================================
// AxForm schema generator
// 4-tier approach based on 5,682 real Foundation forms.
// IMPORTANT: form captions should use plain text strings, not
// label references (@Label:Key), unless the label was compiled
// in a PREVIOUS VS2022 build. If you pass a label reference for
// a label created in the same batch, D365 shows the raw key.
// ============================================================
import type { FormDataSourceDef, FastTabDef, ActionButtonDef, MethodDef } from './types.js';

export const FORM_PATTERNS: Record<string, { style: string; version: string }> = {
  SimpleList:                           { style: 'SimpleList',            version: '1.1' },
  Dialog:                               { style: 'Dialog',                version: '1.2' },
  SimpleListDetails:                    { style: 'SimpleListDetails',      version: '1.3' },
  Task:                                 { style: '',                       version: '1.2' },
  FormPartFactboxCard:                  { style: 'FormPart',               version: 'UX7 1.0' },
  LookupGridOnly:                       { style: 'Lookup',                 version: '1.1' },
  DropDialog:                           { style: 'DropDialog',             version: '1.2' },
  'SimpleDetails-FastTabsContainer':    { style: '',                       version: '1.4' },
  'SimpleListDetails-Grid':             { style: 'SimpleListDetails',      version: '1.4' },
  TaskParentChild:                      { style: '',                       version: '1.2' },
  ListPage:                             { style: 'ListPage',               version: 'UX7 1.0' },
  DetailsMaster:                        { style: 'DetailsFormMaster',      version: '1.4' },
  FormPartFactboxGrid:                  { style: 'FormPart',               version: '1.1' },
  DialogTabs:                           { style: 'Dialog',                 version: '1.3' },
  FormPartSectionList:                  { style: 'FormPart',               version: '1.2' },
  'SimpleDetails-StandardTabsContainer':{ style: '',                       version: '1.5' },
  DialogFastTabs:                       { style: 'Dialog',                 version: '1.0' },
  TableOfContents:                      { style: 'TableOfContents',        version: '1.1' },
  DetailsTransaction:                   { style: 'DetailsFormTransaction', version: '1.4' },
  Wizard:                               { style: 'Wizard',                 version: '1.2' },
  DialogReadOnly:                       { style: 'Dialog',                 version: '1.2' },
  LookupTab:                            { style: 'Lookup',                 version: '1.0' },
  WorkspaceOperational:                 { style: 'Workspace',              version: '1.1' },
  TabbedWorkspace:                      { style: 'Workspace',              version: '1.0' },
  DropDialogReadOnly:                   { style: 'DropDialog',             version: '1.2' },
  AdvancedSelection:                    { style: '',                       version: '1.1' },
  Custom:                               { style: '',                       version: '1.0' },
};

export interface AxFormSpec {
  name: string;
  pattern?: string;
  patternVersion?: string;
  caption?: string;
  titleDataSource?: string;
  windowType?: 'Slider' | 'Popup';
  viewEditMode?: 'View' | 'Edit';
  setCompany?: boolean;
  dataSources?: FormDataSourceDef[];
  listFields?: string[];
  detailFastTabs?: FastTabDef[];
  actionPaneButtons?: ActionButtonDef[];
  scaffoldOnly?: boolean;
  methods?: MethodDef[];
  /** Map of fieldName → AxTableField i:type (e.g. 'AxTableFieldDate', 'AxTableFieldEnum')
   *  Used to emit the correct AxFormControl type. Default is String for unknown fields. */
  fieldTypes?: Record<string, string>;
}

// ── Field → Form control type mapping ────────────────────────────────────────

function formControlType(fieldName: string, fieldTypes?: Record<string, string>): { itype: string; type: string } {
  const tableFieldType = fieldTypes?.[fieldName] ?? 'AxTableFieldString';
  const map: Record<string, { itype: string; type: string }> = {
    AxTableFieldString:        { itype: 'AxFormStringControl',  type: 'String'  },
    AxTableFieldInt:           { itype: 'AxFormIntegerControl', type: 'Integer' },
    AxTableFieldInt64:         { itype: 'AxFormInt64Control',   type: 'Int64'   },
    AxTableFieldReal:          { itype: 'AxFormRealControl',    type: 'Real'    },
    AxTableFieldDate:          { itype: 'AxFormDateControl',    type: 'Date'    },
    AxTableFieldUtcDateTime:   { itype: 'AxFormDateTimeControl',type: 'DateTime'},
    AxTableFieldEnum:          { itype: 'AxFormComboBoxControl', type: 'ComboBox' },
    AxTableFieldGuid:          { itype: 'AxFormGuidControl',    type: 'String'  },
    AxTableFieldContainer:     { itype: 'AxFormStringControl',  type: 'String'  },
    AxTableFieldTime:          { itype: 'AxFormTimeControl',    type: 'Time'    },
  };
  return map[tableFieldType] ?? { itype: 'AxFormStringControl', type: 'String' };
}

export function generateForm(spec: AxFormSpec): string {
  const pattern = spec.pattern ?? 'SimpleList';
  const patInfo = FORM_PATTERNS[pattern] ?? { style: '', version: '1.0' };
  const version = spec.patternVersion ?? patInfo.version;
  const style   = patInfo.style;

  if (['Dialog','DropDialog','DropDialogReadOnly','DialogReadOnly',
       'DialogTabs','DialogFastTabs','DialogDoubleTabs'].includes(pattern)) {
    return generateDialogForm(spec, pattern, version, style);
  }
  if (pattern === 'SimpleList' || pattern === 'LookupGridOnly') {
    return generateSimpleListForm(spec, pattern, version, style);
  }
  if (['SimpleListDetails','SimpleListDetails-Grid',
       'SimpleListDetails-Tree'].includes(pattern)) {
    return generateSimpleListDetailsForm(spec, pattern, version, style);
  }
  return generateScaffoldForm(spec, pattern, version, style);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function formHeader(spec: AxFormSpec): string {
  const methods = (spec.methods ?? []).map(m =>
    `\t\t\t<Method>\n\t\t\t\t<Name>${m.name}</Name>\n\t\t\t\t<Source><![CDATA[\n${m.source}\n]]></Source>\n\t\t\t</Method>`
  ).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<AxForm xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="Microsoft.Dynamics.AX.Metadata.V6">
\t<Name>${spec.name}</Name>
\t<SourceCode>
\t\t<Methods xmlns="">
\t\t\t<Method>
\t\t\t\t<Name>classDeclaration</Name>
\t\t\t\t<Source><![CDATA[
[Form]
public class ${spec.name} extends FormRun
{
}
]]></Source>
\t\t\t</Method>
${methods}
\t\t</Methods>
\t\t<DataSources xmlns="" />
\t\t<DataControls xmlns="" />
\t\t<Members xmlns="" />
\t</SourceCode>`;
}

function formDataSources(sources: FormDataSourceDef[]): string {
  if (!sources.length) return '\t<DataSources />';
  return `\t<DataSources>\n${sources.map(generateDataSource).join('\n')}\n\t</DataSources>`;
}

function generateDataSource(ds: FormDataSourceDef): string {
  const name = ds.name ?? ds.table;
  const fields = ds.fields?.length
    ? `\t\t\t<Fields>\n${ds.fields.map(f => `\t\t\t\t<AxFormDataSourceField>\n\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t</AxFormDataSourceField>`).join('\n')}\n\t\t\t</Fields>`
    : `\t\t\t<Fields />`;
  const insertIfEmpty = ds.insertIfEmpty === true ? '' : '\n\t\t\t<InsertIfEmpty>No</InsertIfEmpty>';
  const allowCreate   = ds.allowCreate === false  ? '\n\t\t\t<AllowCreate>No</AllowCreate>' : '';
  const joinSource    = ds.joinSource ? `\n\t\t\t<JoinSource>${ds.joinSource}</JoinSource>` : '';
  const linkType      = ds.linkType   ? `\n\t\t\t<LinkType>${ds.linkType}</LinkType>` : '';
  return `\t\t<AxFormDataSource xmlns="">
\t\t\t<Name>${name}</Name>
\t\t\t<Table>${ds.table}</Table>
${fields}
\t\t\t<ReferencedDataSources />${insertIfEmpty}${allowCreate}${joinSource}${linkType}
\t\t\t<DataSourceLinks />
\t\t\t<DerivedDataSources />
\t\t</AxFormDataSource>`;
}

function formFooter(): string {
  return '\t<Parts />\n</AxForm>';
}

// ── Tier 1: Dialog ────────────────────────────────────────────────────────────

function generateDialogForm(
  spec: AxFormSpec, pattern: string, version: string, style: string,
): string {
  const ds = spec.dataSources ?? [];
  const primaryDs = ds[0]?.name ?? ds[0]?.table ?? '';
  const fields  = spec.listFields ?? [];
  const buttons = spec.actionPaneButtons ?? [
    { name: 'OKButton', command: 'OK' },
    { name: 'CancelButton', command: 'Cancel' },
  ];
  const fieldControls = fields.map(f =>
    `\t\t\t\t\t<AxFormControl xmlns="" i:type="AxFormStringControl">\n\t\t\t\t\t\t<Name>${spec.name}_${f}</Name>\n\t\t\t\t\t\t<Type>String</Type>\n\t\t\t\t\t\t<FormControlExtension i:nil="true" />\n\t\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t\t\t<DataSource>${primaryDs}</DataSource>\n\t\t\t\t\t</AxFormControl>`
  ).join('\n');
  const buttonControls = buttons.map(b => {
    const cancel = b.command === 'Cancel' || b.name.toLowerCase().includes('cancel');
    const ok     = b.command === 'OK'     || b.name.toLowerCase().includes('ok');
    return `\t\t\t\t\t<AxFormControl xmlns="" i:type="AxFormCommandButtonControl">\n\t\t\t\t\t\t<Name>${b.name}</Name>\n\t\t\t\t\t\t<Type>CommandButton</Type>\n\t\t\t\t\t\t<FormControlExtension i:nil="true" />\n\t\t\t\t\t\t<Command>${b.command ?? (cancel ? 'Cancel' : 'OK')}</Command>${ok ? '\n\t\t\t\t\t\t<DefaultButton>Yes</DefaultButton>' : ''}${cancel ? '\n\t\t\t\t\t\t<SaveRecord>No</SaveRecord>' : ''}\n\t\t\t\t\t</AxFormControl>`;
  }).join('\n');

  return `${formHeader(spec)}
${formDataSources(ds)}
\t<Design>
\t\t<Caption xmlns="">${spec.caption ?? spec.name}</Caption>
\t\t<Pattern xmlns="">${pattern}</Pattern>
\t\t<PatternVersion xmlns="">${version}</PatternVersion>
\t\t<Style xmlns="">${style}</Style>${spec.windowType ? `\n\t\t<WindowType xmlns="">${spec.windowType}</WindowType>` : ''}
\t\t<Controls xmlns="">
\t\t\t<AxFormControl xmlns="" i:type="AxFormGroupControl">
\t\t\t\t<Name>DialogContent</Name>
\t\t\t\t<Pattern>FieldsFieldGroups</Pattern>
\t\t\t\t<PatternVersion>1.1</PatternVersion>
\t\t\t\t<Type>Group</Type>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls>
${fieldControls}
\t\t\t\t</Controls>
\t\t\t\t<ColumnsMode>Fill</ColumnsMode>
\t\t\t\t<Style>DialogContent</Style>
\t\t\t</AxFormControl>
\t\t\t<AxFormControl xmlns="" i:type="AxFormButtonGroupControl">
\t\t\t\t<Name>ButtonGroup</Name>
\t\t\t\t<Type>ButtonGroup</Type>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls>
${buttonControls}
\t\t\t\t</Controls>
\t\t\t\t<ArrangeMethod>HorizontalRight</ArrangeMethod>
\t\t\t\t<Style>DialogCommitContainer</Style>
\t\t\t</AxFormControl>
\t\t</Controls>
\t</Design>
${formFooter()}`;
}

// ── Tier 2: SimpleList ────────────────────────────────────────────────────────

function generateSimpleListForm(
  spec: AxFormSpec, pattern: string, version: string, style: string,
): string {
  const ds        = spec.dataSources ?? [];
  const primaryDs = ds[0]?.name ?? ds[0]?.table ?? spec.name;
  const fields    = spec.listFields ?? [];
  const firstField = fields[0] ?? 'Id';
  const caption   = spec.caption ?? spec.name;

  // Meaningful control names: based on table name, not generic numbered names
  const actionPaneName = `${spec.name}_ActionPane`;
  const filterGroupName = `${spec.name}_FilterGroup`;
  const quickFilterName = `${spec.name}_QuickFilter`;
  const gridName        = `${spec.name}_Grid`;

  const gridControls = fields.map(f => {
    const ct = formControlType(f, spec.fieldTypes);
    return `\t\t\t\t<AxFormControl xmlns="" i:type="${ct.itype}">\n\t\t\t\t\t<Name>${spec.name}_${f}</Name>\n\t\t\t\t\t<Type>${ct.type}</Type>\n\t\t\t\t\t<FormControlExtension i:nil="true" />\n\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t\t<DataSource>${primaryDs}</DataSource>\n\t\t\t\t</AxFormControl>`;
  }).join('\n');

  return `${formHeader(spec)}
${formDataSources(ds)}
\t<Design>
\t\t<Caption xmlns="">${caption}</Caption>
\t\t<DataSource xmlns="">${primaryDs}</DataSource>
\t\t<Pattern xmlns="">${pattern}</Pattern>
\t\t<PatternVersion xmlns="">${version}</PatternVersion>
\t\t<Style xmlns="">${style}</Style>
\t\t<TitleDataSource xmlns="">${spec.titleDataSource ?? primaryDs}</TitleDataSource>
\t\t<Controls xmlns="">
\t\t\t<AxFormControl xmlns="" i:type="AxFormActionPaneControl">
\t\t\t\t<Name>${actionPaneName}</Name>
\t\t\t\t<Type>ActionPane</Type>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls />
\t\t\t</AxFormControl>
\t\t\t<AxFormControl xmlns="" i:type="AxFormGroupControl">
\t\t\t\t<Name>${filterGroupName}</Name>
\t\t\t\t<Pattern>CustomAndQuickFilters</Pattern>
\t\t\t\t<PatternVersion>1.1</PatternVersion>
\t\t\t\t<Type>Group</Type>
\t\t\t\t<WidthMode>SizeToAvailable</WidthMode>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls>
\t\t\t\t\t<AxFormControl>
\t\t\t\t\t\t<Name>${quickFilterName}</Name>
\t\t\t\t\t\t<FormControlExtension>
\t\t\t\t\t\t\t<Name>QuickFilterControl</Name>
\t\t\t\t\t\t\t<ExtensionComponents />
\t\t\t\t\t\t\t<ExtensionProperties>
\t\t\t\t\t\t\t\t<AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t\t<Name>targetControlName</Name>
\t\t\t\t\t\t\t\t\t<Type>String</Type>
\t\t\t\t\t\t\t\t\t<Value>${gridName}</Value>
\t\t\t\t\t\t\t\t</AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t<AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t\t<Name>defaultColumnName</Name>
\t\t\t\t\t\t\t\t\t<Type>String</Type>
\t\t\t\t\t\t\t\t\t<Value>${spec.name}_${firstField}</Value>
\t\t\t\t\t\t\t\t</AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t<AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t\t<Name>placeholderText</Name>
\t\t\t\t\t\t\t\t\t<Type>String</Type>
\t\t\t\t\t\t\t\t</AxFormControlExtensionProperty>
\t\t\t\t\t\t\t</ExtensionProperties>
\t\t\t\t\t\t</FormControlExtension>
\t\t\t\t\t</AxFormControl>
\t\t\t\t</Controls>
\t\t\t\t<ArrangeMethod>HorizontalLeft</ArrangeMethod>
\t\t\t\t<FrameType>None</FrameType>
\t\t\t\t<Style>CustomFilter</Style>
\t\t\t\t<ViewEditMode>Edit</ViewEditMode>
\t\t\t</AxFormControl>
\t\t\t<AxFormControl xmlns="" i:type="AxFormGridControl">
\t\t\t\t<Name>${gridName}</Name>
\t\t\t\t<Type>Grid</Type>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls>
${gridControls}
\t\t\t\t</Controls>
\t\t\t\t<DataSource>${primaryDs}</DataSource>
\t\t\t\t<Style>Tabular</Style>
\t\t\t</AxFormControl>
\t\t</Controls>
\t</Design>
${formFooter()}`;
}

// ── Tier 3: SimpleListDetails ─────────────────────────────────────────────────

function generateSimpleListDetailsForm(
  spec: AxFormSpec, pattern: string, version: string, style: string,
): string {
  const ds        = spec.dataSources ?? [];
  const primaryDs = ds[0]?.name ?? ds[0]?.table ?? spec.name;
  const listFields = spec.listFields ?? [];
  const firstField = listFields[0] ?? 'Id';
  const fastTabs  = spec.detailFastTabs ?? [];
  const caption   = spec.caption ?? spec.name;

  const navGridCols = listFields.map(f => {
    const ct = formControlType(f, spec.fieldTypes);
    return `\t\t\t\t\t<AxFormControl xmlns="" i:type="${ct.itype}">\n\t\t\t\t\t\t<Name>${primaryDs}_${f}</Name>\n\t\t\t\t\t\t<Type>${ct.type}</Type>\n\t\t\t\t\t\t<FormControlExtension i:nil="true" />\n\t\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t\t\t<DataSource>${primaryDs}</DataSource>\n\t\t\t\t\t</AxFormControl>`;
  }).join('\n');

  const headerFields = listFields.map(f => {
    const ct = formControlType(f, spec.fieldTypes);
    return `\t\t\t\t<AxFormControl xmlns="" i:type="${ct.itype}">\n\t\t\t\t\t<Name>Details_${primaryDs}_${f}</Name>\n\t\t\t\t\t<Type>${ct.type}</Type>\n\t\t\t\t\t<FormControlExtension i:nil="true" />\n\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t\t<DataSource>${primaryDs}</DataSource>\n\t\t\t\t</AxFormControl>`;
  }).join('\n');

  const tabPages = fastTabs.map(tab => {
    const tabFields = tab.fields.map(f => {
      const ct = formControlType(f, spec.fieldTypes);
      return `\t\t\t\t\t\t<AxFormControl xmlns="" i:type="${ct.itype}">\n\t\t\t\t\t\t\t<Name>${primaryDs}_${f}_Detail</Name>\n\t\t\t\t\t\t\t<Type>${ct.type}</Type>\n\t\t\t\t\t\t\t<FormControlExtension i:nil="true" />\n\t\t\t\t\t\t\t<DataField>${f}</DataField>\n\t\t\t\t\t\t\t<DataSource>${primaryDs}</DataSource>\n\t\t\t\t\t\t</AxFormControl>`;
    }).join('\n');
    return `\t\t\t\t<AxFormControl xmlns="" i:type="AxFormTabPageControl">\n\t\t\t\t\t<Name>${tab.caption.replace(/\s/g,'')}</Name>\n\t\t\t\t\t<Pattern>FieldsFieldGroups</Pattern>\n\t\t\t\t\t<PatternVersion>1.1</PatternVersion>\n\t\t\t\t\t<Type>TabPage</Type>\n\t\t\t\t\t<FormControlExtension i:nil="true" />\n\t\t\t\t\t<Controls>\n${tabFields}\n\t\t\t\t\t</Controls>\n\t\t\t\t\t<ColumnsMode>Fill</ColumnsMode>\n\t\t\t\t\t<Caption>${tab.caption}</Caption>\n\t\t\t\t</AxFormControl>`;
  }).join('\n');

  return `${formHeader(spec)}
${formDataSources(ds)}
\t<Design>
\t\t<Caption xmlns="">${caption}</Caption>
\t\t<Pattern xmlns="">${pattern}</Pattern>
\t\t<PatternVersion xmlns="">${version}</PatternVersion>
\t\t<Style xmlns="">${style}</Style>
\t\t<Controls xmlns="">
\t\t\t<AxFormControl xmlns="" i:type="AxFormActionPaneControl">
\t\t\t\t<Name>${spec.name}_ActionPane</Name>
\t\t\t\t<Type>ActionPane</Type>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls />
\t\t\t</AxFormControl>
\t\t\t<AxFormControl xmlns="" i:type="AxFormGroupControl">
\t\t\t\t<Name>NavigationListGroup</Name>
\t\t\t\t<HeightMode>SizeToAvailable</HeightMode>
\t\t\t\t<Type>Group</Type>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls>
\t\t\t\t\t<AxFormControl>
\t\t\t\t\t\t<Name>${spec.name}_QuickFilter</Name>
\t\t\t\t\t\t<WidthMode>SizeToAvailable</WidthMode>
\t\t\t\t\t\t<FormControlExtension>
\t\t\t\t\t\t\t<Name>QuickFilterControl</Name>
\t\t\t\t\t\t\t<ExtensionComponents />
\t\t\t\t\t\t\t<ExtensionProperties>
\t\t\t\t\t\t\t\t<AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t\t<Name>targetControlName</Name>
\t\t\t\t\t\t\t\t\t<Type>String</Type>
\t\t\t\t\t\t\t\t\t<Value>NavigationListGrid</Value>
\t\t\t\t\t\t\t\t</AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t<AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t\t<Name>defaultColumnName</Name>
\t\t\t\t\t\t\t\t\t<Type>String</Type>
\t\t\t\t\t\t\t\t\t<Value>${primaryDs}_${firstField}</Value>
\t\t\t\t\t\t\t\t</AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t<AxFormControlExtensionProperty>
\t\t\t\t\t\t\t\t\t<Name>placeholderText</Name>
\t\t\t\t\t\t\t\t\t<Type>String</Type>
\t\t\t\t\t\t\t\t</AxFormControlExtensionProperty>
\t\t\t\t\t\t\t</ExtensionProperties>
\t\t\t\t\t\t</FormControlExtension>
\t\t\t\t\t</AxFormControl>
\t\t\t\t\t<AxFormControl xmlns="" i:type="AxFormGridControl">
\t\t\t\t\t\t<Name>NavigationListGrid</Name>
\t\t\t\t\t\t<AllowEdit>No</AllowEdit>
\t\t\t\t\t\t<Type>Grid</Type>
\t\t\t\t\t\t<WidthMode>SizeToContent</WidthMode>
\t\t\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t\t\t<Controls>
${navGridCols}
\t\t\t\t\t\t</Controls>
\t\t\t\t\t\t<DataSource>${primaryDs}</DataSource>
\t\t\t\t\t\t<MultiSelect>No</MultiSelect>
\t\t\t\t\t\t<ShowRowLabels>No</ShowRowLabels>
\t\t\t\t\t\t<Style>List</Style>
\t\t\t\t\t</AxFormControl>
\t\t\t\t</Controls>
\t\t\t\t<FrameType>None</FrameType>
\t\t\t\t<Style>SidePanel</Style>
\t\t\t</AxFormControl>
\t\t\t<AxFormControl xmlns="" i:type="AxFormGroupControl">
\t\t\t\t<Name>DetailsHeaderGroup</Name>
\t\t\t\t<Pattern>FieldsFieldGroups</Pattern>
\t\t\t\t<PatternVersion>1.1</PatternVersion>
\t\t\t\t<Type>Group</Type>
\t\t\t\t<WidthMode>SizeToAvailable</WidthMode>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls>
${headerFields}
\t\t\t\t</Controls>
\t\t\t\t<ColumnsMode>Fill</ColumnsMode>
\t\t\t\t<FrameType>None</FrameType>
\t\t\t</AxFormControl>
\t\t\t<AxFormControl xmlns="" i:type="AxFormTabControl">
\t\t\t\t<Name>DetailsTab</Name>
\t\t\t\t<Type>Tab</Type>
\t\t\t\t<FormControlExtension i:nil="true" />
\t\t\t\t<Controls>
${tabPages}
\t\t\t\t</Controls>
\t\t\t\t<Style>FastTabs</Style>
\t\t\t</AxFormControl>
\t\t</Controls>
\t</Design>
${formFooter()}`;
}

// ── Tier 4: Scaffold ──────────────────────────────────────────────────────────

function generateScaffoldForm(
  spec: AxFormSpec, pattern: string, version: string, style: string,
): string {
  const ds = spec.dataSources ?? [];
  const styleLine = style ? `\t\t<Style xmlns="">${style}</Style>\n` : '';
  return `${formHeader(spec)}
${formDataSources(ds)}
\t<Design>
\t\t<Caption xmlns="">${spec.caption ?? spec.name}</Caption>
\t\t<Pattern xmlns="">${pattern}</Pattern>
\t\t<PatternVersion xmlns="">${version}</PatternVersion>
${styleLine}\t\t<Controls xmlns="" />
\t</Design>
${formFooter()}`;
}
