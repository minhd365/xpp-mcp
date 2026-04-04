import { TableSpec, FieldDef, FieldType } from './types';
import { rootElement, closeElement } from './namespaces';

/**
 * Generate a complete AxTable XML string.
 * Confirmed correct from live D365 F&O 10.37 filesystem scan.
 */
export function generateTable(spec: TableSpec): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push(rootElement('AxTable'));

  lines.push(`\t<Name>${spec.name}</Name>`);

  // SourceCode block
  lines.push('\t<SourceCode>');
  lines.push('\t\t<Declaration><![CDATA[');
  if (spec.classDeclaration) {
    lines.push(spec.classDeclaration);
  } else {
    lines.push(`public class ${spec.name} extends common`);
    lines.push('{');
    lines.push('}');
  }
  lines.push(']]></Declaration>');

  if (spec.methods && spec.methods.length > 0) {
    lines.push('\t\t<Methods>');
    for (const m of spec.methods) {
      lines.push('\t\t\t<Method>');
      lines.push(`\t\t\t\t<Name>${m.name}</Name>`);
      lines.push('\t\t\t\t<Source><![CDATA[');
      lines.push(m.source);
      lines.push(']]></Source>');
      lines.push('\t\t\t</Method>');
    }
    lines.push('\t\t</Methods>');
  } else {
    lines.push('\t\t<Methods />');
  }
  lines.push('\t</SourceCode>');

  // Optional metadata properties
  if (spec.developerDocumentation) {
    lines.push(`\t<DeveloperDocumentation>${spec.developerDocumentation}</DeveloperDocumentation>`);
  }
  if (spec.label) {
    lines.push(`\t<Label>${spec.label}</Label>`);
  }
  if (spec.titleField1) {
    lines.push(`\t<TitleField1>${spec.titleField1}</TitleField1>`);
  }
  if (spec.titleField2) {
    lines.push(`\t<TitleField2>${spec.titleField2}</TitleField2>`);
  }
  if (spec.modules) {
    lines.push(`\t<Modules>${spec.modules}</Modules>`);
  }
  if (spec.tableGroup) {
    lines.push(`\t<TableGroup>${spec.tableGroup}</TableGroup>`);
  }
  if (spec.cacheLookup) {
    lines.push(`\t<CacheLookup>${spec.cacheLookup}</CacheLookup>`);
  }
  if (spec.saveDataPerCompany === false) {
    lines.push(`\t<SaveDataPerCompany>No</SaveDataPerCompany>`);
  }
  if (spec.primaryIndex) {
    lines.push(`\t<PrimaryIndex>${spec.primaryIndex}</PrimaryIndex>`);
  }

  // DeleteActions
  if (spec.deleteActions && spec.deleteActions.length > 0) {
    lines.push('\t<DeleteActions>');
    for (const da of spec.deleteActions) {
      lines.push('\t\t<AxTableDeleteAction>');
      lines.push(`\t\t\t<Name>${da.table}</Name>`);
      lines.push(`\t\t\t<DeleteAction>${da.action}</DeleteAction>`);
      lines.push('\t\t\t<Relation></Relation>');
      lines.push(`\t\t\t<Table>${da.table}</Table>`);
      lines.push('\t\t</AxTableDeleteAction>');
    }
    lines.push('\t</DeleteActions>');
  } else {
    lines.push('\t<DeleteActions />');
  }

  // FieldGroups
  const fgLines = generateFieldGroups(spec);
  lines.push(...fgLines);

  // Fields
  lines.push('\t<Fields>');
  for (const f of (spec.fields ?? [])) {
    lines.push(...generateField(f));
  }
  lines.push('\t</Fields>');

  // FullTextIndexes, Indexes, Mappings, Relations, StateMachines
  lines.push('\t<FullTextIndexes />');

  if (spec.indexes && spec.indexes.length > 0) {
    lines.push('\t<Indexes>');
    for (const idx of spec.indexes) {
      lines.push('\t\t<AxTableIndex>');
      lines.push(`\t\t\t<Name>${idx.name}</Name>`);
      if (idx.allowPageLocks === false) {
        lines.push('\t\t\t<AllowPageLocks>No</AllowPageLocks>');
      }
      if (idx.unique) {
        lines.push('\t\t\t<AlternateKey>Yes</AlternateKey>');
      }
      lines.push('\t\t\t<Fields>');
      for (const f of idx.fields) {
        lines.push('\t\t\t\t<AxTableIndexField>');
        lines.push(`\t\t\t\t\t<DataField>${f}</DataField>`);
        lines.push('\t\t\t\t</AxTableIndexField>');
      }
      lines.push('\t\t\t</Fields>');
      lines.push('\t\t</AxTableIndex>');
    }
    lines.push('\t</Indexes>');
  } else {
    lines.push('\t<Indexes />');
  }

  lines.push('\t<Mappings />');

  if (spec.relations && spec.relations.length > 0) {
    lines.push('\t<Relations>');
    for (const rel of spec.relations) {
      lines.push('\t\t<AxTableRelation>');
      lines.push(`\t\t\t<Name>${rel.name}</Name>`);
      if (rel.cardinality) lines.push(`\t\t\t<Cardinality>${rel.cardinality}</Cardinality>`);
      if (rel.onDelete) lines.push(`\t\t\t<OnDelete>${rel.onDelete}</OnDelete>`);
      lines.push(`\t\t\t<RelatedTable>${rel.relatedTable}</RelatedTable>`);
      if (rel.relatedTableCardinality) lines.push(`\t\t\t<RelatedTableCardinality>${rel.relatedTableCardinality}</RelatedTableCardinality>`);
      if (rel.relatedTableRole) lines.push(`\t\t\t<RelatedTableRole>${rel.relatedTableRole}</RelatedTableRole>`);
      if (rel.relationshipType) lines.push(`\t\t\t<RelationshipType>${rel.relationshipType}</RelationshipType>`);
      if (rel.role) lines.push(`\t\t\t<Role>${rel.role}</Role>`);
      lines.push('\t\t\t<UseDefaultRoleNames>No</UseDefaultRoleNames>');
      lines.push('\t\t\t<Constraints>');
      for (const c of rel.constraints) {
        lines.push(`\t\t\t\t<AxTableRelationConstraint xmlns="" i:type="AxTableRelationConstraintField">`);
        lines.push(`\t\t\t\t\t<Name>${c.name}</Name>`);
        lines.push(`\t\t\t\t\t<Field>${c.field}</Field>`);
        lines.push(`\t\t\t\t\t<RelatedField>${c.relatedField}</RelatedField>`);
        lines.push('\t\t\t\t</AxTableRelationConstraint>');
      }
      lines.push('\t\t\t</Constraints>');
      lines.push('\t\t</AxTableRelation>');
    }
    lines.push('\t</Relations>');
  } else {
    lines.push('\t<Relations />');
  }

  lines.push('\t<StateMachines />');
  lines.push(closeElement('AxTable'));

  return lines.join('\n');
}

function generateFieldGroups(spec: TableSpec): string[] {
  const lines: string[] = [];

  const standardGroups = ['AutoReport', 'AutoLookup', 'AutoIdentification', 'AutoSummary', 'AutoBrowse'];
  const userGroups = spec.fieldGroups ?? [];
  const userGroupNames = new Set(userGroups.map(g => g.name));

  const allGroups: Array<{ name: string; label?: string; fields: string[]; autoPopulate?: boolean }> = [
    ...userGroups,
    ...standardGroups
      .filter(sg => !userGroupNames.has(sg))
      .map(sg => ({ name: sg, fields: [] })),
  ];

  lines.push('\t<FieldGroups>');
  for (const g of allGroups) {
    lines.push('\t\t<AxTableFieldGroup>');
    lines.push(`\t\t\t<Name>${g.name}</Name>`);
    // AutoIdentification requires AutoPopulate=Yes so D365 recognises the natural key
    if (g.name === 'AutoIdentification') {
      lines.push('\t\t\t<AutoPopulate>Yes</AutoPopulate>');
    }
    if (g.label) lines.push(`\t\t\t<Label>${g.label}</Label>`);
    if (g.fields.length > 0) {
      lines.push('\t\t\t<Fields>');
      for (const f of g.fields) {
        lines.push('\t\t\t\t<AxTableFieldGroupField>');
        lines.push(`\t\t\t\t\t<DataField>${f}</DataField>`);
        lines.push('\t\t\t\t</AxTableFieldGroupField>');
      }
      lines.push('\t\t\t</Fields>');
    } else {
      lines.push('\t\t\t<Fields />');
    }
    lines.push('\t\t</AxTableFieldGroup>');
  }
  lines.push('\t</FieldGroups>');
  return lines;
}

/** Generate a single AxTableField element. */
export function generateField(f: FieldDef): string[] {
  const iType = fieldIType(f.fieldType);
  const lines: string[] = [];

  lines.push(`\t\t<AxTableField xmlns="" i:type="${iType}">`);
  lines.push(`\t\t\t<Name>${f.name}</Name>`);
  lines.push(`\t\t\t<AssetClassification>System Metadata</AssetClassification>`);
  if (f.edt) {
    lines.push(`\t\t\t<ExtendedDataType>${f.edt}</ExtendedDataType>`);
  }
  if (f.label) {
    lines.push(`\t\t\t<Label>${f.label}</Label>`);
  }
  if (f.helpText) {
    lines.push(`\t\t\t<HelpText>${f.helpText}</HelpText>`);
  }
  if (f.mandatory) {
    lines.push(`\t\t\t<Mandatory>Yes</Mandatory>`);
  }
  if (f.allowEdit === false) {
    lines.push(`\t\t\t<AllowEdit>No</AllowEdit>`);
  }
  if (f.allowEditOnCreate === false) {
    lines.push(`\t\t\t<AllowEditOnCreate>No</AllowEditOnCreate>`);
  }
  if (f.visible === false) {
    lines.push(`\t\t\t<Visible>No</Visible>`);
  }
  if (f.null === false) {
    lines.push(`\t\t\t<Null>No</Null>`);
  }
  if (f.fieldType === 'Enum' && f.enumType) {
    lines.push(`\t\t\t<EnumType>${f.enumType}</EnumType>`);
  }
  lines.push(`\t\t</AxTableField>`);

  return lines;
}

/** Map FieldType → AxTableField i:type value */
export function fieldIType(fieldType: FieldType): string {
  const map: Record<FieldType, string> = {
    String:   'AxTableFieldString',
    Int:      'AxTableFieldInt',
    Int64:    'AxTableFieldInt64',
    Real:     'AxTableFieldReal',
    Date:     'AxTableFieldDate',
    DateTime: 'AxTableFieldUtcDateTime',
    Enum:     'AxTableFieldEnum',
    Guid:     'AxTableFieldGuid',
    Container:'AxTableFieldContainer',
    Time:     'AxTableFieldTime',
  };
  return map[fieldType] ?? 'AxTableFieldString';
}
