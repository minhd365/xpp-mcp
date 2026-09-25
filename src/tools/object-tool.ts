import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { ModelRegistry } from '../core/model-registry';
import { AotWriter }     from '../core/aot-writer';
import { LabelManager }  from '../core/label-manager';
import { getHandler, listSupportedTypes } from '../schemas/registry';
import { canonicalFolder } from '../schemas/namespaces';
import type {
  TableSpec, ClassSpec, EnumSpec, EdtSpec,
  FormDataSourceDef, FastTabDef, ActionButtonDef,
  EntryPointDef, MenuExtensionElementDef,
} from '../schemas/types';
import type { AxFormSpec }           from '../schemas/ax-form';
import type { AxClassSpec, AxEnumSpec, AxEdtSpec, AxQuerySpec, QueryDataSourceSpec }
  from '../schemas/ax-class-enum-edt-query';
import type { AxPrivilegeSpec, AxDutySpec, AxRoleSpec, AxMenuItemSpec, AxMenuSpec, AxMenuExtensionSpec, AxTableExtensionSpec }
  from '../schemas/ax-security-menu';

// ─── Zod input schema ────────────────────────────────────────────────────────

const FieldSchema = z.object({
  name: z.string(), fieldType: z.string(),
  label: z.string().optional(), helpText: z.string().optional(),
  edt: z.string().optional(), enumType: z.string().optional(),
  mandatory: z.boolean().optional(), allowEdit: z.boolean().optional(),
  allowEditOnCreate: z.boolean().optional(), visible: z.boolean().optional(),
  null: z.boolean().optional(),
});
const IndexSchema = z.object({
  name: z.string(), fields: z.array(z.string()),
  unique: z.boolean().optional(), clustered: z.boolean().optional(),
});
const RelConstraintSchema = z.object({
  name: z.string(), field: z.string(), relatedField: z.string(),
});
const RelationSchema = z.object({
  name: z.string(), relatedTable: z.string(), constraints: z.array(RelConstraintSchema),
  onDelete: z.string().optional(), cardinality: z.string().optional(),
  relatedTableCardinality: z.string().optional(), relationshipType: z.string().optional(),
  role: z.string().optional(), relatedTableRole: z.string().optional(),
});
const DeleteActionSchema  = z.object({ table: z.string(), action: z.string() });
const FieldGroupSchema    = z.object({ name: z.string(), fields: z.array(z.string()), label: z.string().optional() });
const MethodSchema        = z.object({ name: z.string(), source: z.string() });
const EnumValueSchema     = z.object({ name: z.string(), label: z.string().optional(), value: z.number() });
const DataSourceSchema    = z.object({
  name: z.string().optional(), table: z.string(),
  fields: z.array(z.string()).optional(), joinSource: z.string().optional(),
  linkType: z.string().optional(), insertIfEmpty: z.boolean().optional(), allowCreate: z.boolean().optional(),
});
const FastTabSchema       = z.object({ caption: z.string(), fields: z.array(z.string()) });
const ButtonSchema        = z.object({ name: z.string(), command: z.string().optional(), menuItem: z.string().optional(), label: z.string().optional() });
const EntryPointFormSchema= z.object({ name: z.string() });
const EntryPointSchema    = z.object({
  menuItem: z.string(), objectType: z.string().optional(),
  grants: z.object({ read: z.string().optional(), create: z.string().optional(),
    update: z.string().optional(), delete: z.string().optional(), correct: z.string().optional() }).optional(),
  forms: z.array(EntryPointFormSchema).optional(),
});
const MenuElementSchema   = z.object({ parent: z.string().optional(), menuItemName: z.string(), menuItemType: z.string().optional() });
const QueryDsSchema       = z.object({
  name: z.string(), table: z.string(),
  dynamicFields: z.boolean().optional(), update: z.boolean().optional(),
  ranges: z.array(z.object({ field: z.string(), value: z.string().optional() })).optional(),
  orderBy: z.array(z.object({ field: z.string(), direction: z.string().optional() })).optional(),
});

export const ObjectToolInputSchema = z.object({
  action:    z.enum(['create', 'inspect', 'delete', 'list_types', 'edit']),
  type:      z.string().optional(),
  model:     z.string().optional(),
  name:      z.string().optional(),
  label:     z.string().optional(),
  helpText:  z.string().optional(),
  useLabels: z.boolean().default(true),
  // table
  fields:       z.array(FieldSchema).optional(),
  indexes:      z.array(IndexSchema).optional(),
  relations:    z.array(RelationSchema).optional(),
  deleteActions:z.array(DeleteActionSchema).optional(),
  fieldGroups:  z.array(FieldGroupSchema).optional(),
  tableGroup:   z.string().optional(),
  cacheLookup:  z.string().optional(),
  saveDataPerCompany: z.boolean().optional(),
  primaryIndex: z.string().optional(),
  titleField1:  z.string().optional(),
  titleField2:  z.string().optional(),
  modules:      z.string().optional(),
  methods:      z.array(MethodSchema).optional(),
  classDeclaration: z.string().optional(),
  extends:      z.string().optional(),
  // enum
  values: z.array(EnumValueSchema).optional(),
  // edt
  edtType: z.string().optional(), stringSize: z.number().optional(),
  enumType: z.string().optional(), referenceTable: z.string().optional(),
  allowNegative: z.boolean().optional(),
  // form
  pattern: z.string().optional(), patternVersion: z.string().optional(),
  caption: z.string().optional(), windowType: z.string().optional(),
  viewEditMode: z.string().optional(), titleDataSource: z.string().optional(),
  dataSources:  z.array(DataSourceSchema).optional(),
  listFields:   z.array(z.string()).optional(),
  detailFastTabs: z.array(FastTabSchema).optional(),
  actionPaneButtons: z.array(ButtonSchema).optional(),
  scaffoldOnly: z.boolean().optional(),
  // field type hints for form control type resolution
  fieldTypes: z.record(z.string()).optional(),
  // security
  entryPoints: z.array(EntryPointSchema).optional(),
  privileges:  z.array(z.string()).optional(),
  duties:      z.array(z.string()).optional(),
  description: z.string().optional(),
  // menu
  object: z.string().optional(),
  objectType: z.string().optional(),
  parameters: z.string().optional(),
  standardMenu: z.string().optional(),
  elements: z.array(MenuElementSchema).optional(),
  // query
  queryDataSources: z.array(QueryDsSchema).optional(),
});

export type ObjectToolInput = z.infer<typeof ObjectToolInputSchema>;

// ─── Deps + handler ──────────────────────────────────────────────────────────

export interface ObjectToolDeps {
  registry: ModelRegistry;
  writer: AotWriter;
  labels: LabelManager;
}

export async function handleObjectTool(
  input: ObjectToolInput,
  deps: ObjectToolDeps,
): Promise<string> {
  const { registry, writer, labels } = deps;

  if (input.action === 'list_types') {
    return `Supported object types:\n${listSupportedTypes().map(t => `  - ${t}`).join('\n')}`;
  }

  if (input.action === 'inspect') {
    if (!input.model || !input.type || !input.name) return 'inspect requires: model, type, name';
    const fp = registry.getAotPath(input.model, canonicalFolder(input.type), input.name);
    if (!writer.exists(fp)) return `Object not found: ${fp}`;
    return `File: ${fp}\n\n${writer.readRaw(fp)}`;
  }

  if (input.action === 'delete') {
    if (!input.model || !input.type || !input.name) return 'delete requires: model, type, name';
    const fp = registry.getAotPath(input.model, canonicalFolder(input.type), input.name);
    if (!writer.exists(fp)) return `Object not found: ${fp}`;
    fs.renameSync(fp, fp + '.deleted');
    return `Deleted (renamed to .deleted): ${fp}`;
  }

  // ── edit — in-place XML patch for additive changes ────────────────────────
  // Supports: adding fields to AxTable, adding enum values to AxEnum,
  //           adding listFields to AxForm grids, adding indexes to AxTable.
  // For structural reshaping, use action:"create" (full regeneration).
  if (input.action === 'edit') {
    if (!input.model || !input.type || !input.name) return 'edit requires: model, type, name';
    const fp = registry.getAotPath(input.model, canonicalFolder(input.type), input.name);
    if (!writer.exists(fp)) return `Object not found: ${fp}. Use action:"create" first.`;
    const existing = writer.readRaw(fp);
    const model    = registry.getModel(input.model);
    const useLbls  = input.useLabels !== false;
    const patches: string[] = [];

    // Add new fields to AxTable or AxTableExtension
    if ((input.type === 'AxTable' || input.type === 'AxTableExtension') && input.fields && input.fields.length > 0) {
      const { generateField } = await import('../schemas/ax-table');
      for (const f of input.fields) {
        const resolvedLabel = f.label ? labels.resolve(model, f.name, f.label, useLbls) : undefined;
        const fieldXml = generateField({
          name: f.name, fieldType: f.fieldType as import('../schemas/types').FieldType,
          label: resolvedLabel, helpText: f.helpText, edt: f.edt, enumType: f.enumType,
          mandatory: f.mandatory, allowEdit: f.allowEdit,
          allowEditOnCreate: f.allowEditOnCreate, visible: f.visible, null: f.null,
        }).join('\n');
        // Only add if not already present
        if (existing.includes(`<Name>${f.name}</Name>`)) {
          patches.push(`⚠️  Field "${f.name}" already exists — skipped`);
          continue;
        }
        const insertBefore = '\t</Fields>';
        if (!existing.includes(insertBefore)) {
          return `Cannot patch: <Fields> block not found in ${fp}. Use action:"create" to regenerate.`;
        }
        const patched = existing.replace(insertBefore, `${fieldXml}\n${insertBefore}`);
        writer.write(fp, patched);
        patches.push(`✅ Added field "${f.name}" to ${fp}`);
      }
    }

    // Add new enum values to AxEnum
    if (input.type === 'AxEnum' && input.values && input.values.length > 0) {
      for (const v of input.values) {
        if (existing.includes(`<Name>${v.name}</Name>`)) {
          patches.push(`⚠️  Enum value "${v.name}" already exists — skipped`);
          continue;
        }
        const resolvedLabel = v.label ? labels.resolve(model, v.name, v.label, useLbls) : undefined;
        const valXml = [
          '\t\t<AxEnumValue>',
          `\t\t\t<Name>${v.name}</Name>`,
          resolvedLabel ? `\t\t\t<Label>${resolvedLabel}</Label>` : '',
          `\t\t\t<Value>${v.value}</Value>`,
          '\t\t</AxEnumValue>',
        ].filter(Boolean).join('\n');
        const insertBefore = '\t</EnumValues>';
        if (!existing.includes(insertBefore)) {
          return `Cannot patch: <EnumValues> block not found in ${fp}. Use action:"create".`;
        }
        const current = writer.readRaw(fp);
        writer.write(fp, current.replace(insertBefore, `${valXml}\n${insertBefore}`));
        patches.push(`✅ Added enum value "${v.name}" (${v.value}) to ${fp}`);
      }
    }

    // Add new listFields to AxForm grid (SimpleList/SimpleListDetails)
    if (input.type === 'AxForm' && input.listFields && input.listFields.length > 0) {
      for (const fieldName of input.listFields) {
        if (existing.includes(`<DataField>${fieldName}</DataField>`)) {
          patches.push(`⚠️  Grid field "${fieldName}" already exists — skipped`);
          continue;
        }
        const ctrlXml = [
          '\t\t\t\t\t<AxFormStringControl xmlns="" i:type="AxFormStringControl">',
          `\t\t\t\t\t\t<Name>${fieldName}</Name>`,
          `\t\t\t\t\t\t<DataField>${fieldName}</DataField>`,
          '\t\t\t\t\t</AxFormStringControl>',
        ].join('\n');
        // Find the GridDesign Controls closing tag
        const insertBefore = '\t\t\t\t</Controls>';
        if (!existing.includes(insertBefore)) {
          return `Cannot patch: Grid Controls block not found in ${fp}. The form may use a pattern that requires full regeneration.`;
        }
        const current = writer.readRaw(fp);
        writer.write(fp, current.replace(insertBefore, `${ctrlXml}\n${insertBefore}`));
        patches.push(`✅ Added grid field "${fieldName}" to form ${fp}`);
      }
    }

    if (patches.length === 0) {
      return `No supported edit operations specified for ${input.type}.\nSupported: fields (AxTable/AxTableExtension), values (AxEnum), listFields (AxForm).`;
    }
    return patches.join('\n') + `\n\nNext: d365_build { action:"compile", model:"${input.model}" }`;
  }

  // ── create ────────────────────────────────────────────────────────────────
  if (!input.type)  return 'create requires: type';
  if (!input.model) return 'create requires: model';
  if (!input.name)  return 'create requires: name';

  const handler  = getHandler(input.type);
  const model    = registry.getModel(input.model);
  const useLbls  = input.useLabels !== false;
  const lbl      = input.label ? labels.resolve(model, input.name, input.label, useLbls) : undefined;

  let spec: unknown;

  switch (input.type) {
    case 'AxTable': {
      spec = {
        name: input.name, model: input.model,
        label: lbl, helpText: input.helpText,
        tableGroup: input.tableGroup as TableSpec['tableGroup'],
        cacheLookup: input.cacheLookup as TableSpec['cacheLookup'],
        saveDataPerCompany: input.saveDataPerCompany,
        primaryIndex: input.primaryIndex, titleField1: input.titleField1, titleField2: input.titleField2,
        modules: input.modules, classDeclaration: input.classDeclaration,
        fields: (input.fields ?? []).map(f => ({
          name: f.name, fieldType: f.fieldType as import('../schemas/types').FieldType,
          label: f.label ? labels.resolve(model, f.name, f.label, useLbls) : undefined,
          helpText: f.helpText, edt: f.edt, enumType: f.enumType,
          mandatory: f.mandatory, allowEdit: f.allowEdit,
          allowEditOnCreate: f.allowEditOnCreate, visible: f.visible, null: f.null,
        })),
        indexes: input.indexes,
        relations: (input.relations ?? []).map(r => ({
          ...r, onDelete: r.onDelete as import('../schemas/types').DeleteActionType | undefined,
        })),
        deleteActions: (input.deleteActions ?? []).map(d => ({
          table: d.table, action: d.action as import('../schemas/types').DeleteActionType,
        })),
        fieldGroups: input.fieldGroups, methods: input.methods,
      } as TableSpec;
      break;
    }
    case 'AxClass': {
      spec = {
        name: input.name,
        declaration: input.classDeclaration,
        extends: input.extends,
        methods: input.methods,
      } satisfies AxClassSpec;
      break;
    }
    case 'AxEnum': {
      spec = {
        name: input.name, label: lbl, helpText: input.helpText,
        values: (input.values ?? []).map(v => ({
          ...v, label: v.label ? labels.resolve(model, v.name, v.label, useLbls) : undefined,
        })),
      } satisfies AxEnumSpec;
      break;
    }
    case 'AxEdt': {
      spec = {
        name: input.name,
        edtType: (input.edtType ?? 'String') as AxEdtSpec['edtType'],
        label: lbl, helpText: input.helpText,
        extends: input.extends, stringSize: input.stringSize,
        enumType: input.enumType, referenceTable: input.referenceTable,
      } satisfies AxEdtSpec;
      break;
    }
    case 'AxQuery': {
      spec = {
        name: input.name,
        dataSources: (input.queryDataSources ?? []) as QueryDataSourceSpec[],
        methods: input.methods,
      } satisfies AxQuerySpec;
      break;
    }
    case 'AxForm': {
      spec = {
        name: input.name,
        pattern: input.pattern, patternVersion: input.patternVersion,
        caption: lbl ?? input.caption, titleDataSource: input.titleDataSource,
        windowType: input.windowType as AxFormSpec['windowType'],
        viewEditMode: input.viewEditMode as AxFormSpec['viewEditMode'],
        dataSources: (input.dataSources ?? []) as FormDataSourceDef[],
        listFields: input.listFields,
        detailFastTabs: (input.detailFastTabs ?? []) as FastTabDef[],
        actionPaneButtons: (input.actionPaneButtons ?? []) as ActionButtonDef[],
        methods: input.methods, scaffoldOnly: input.scaffoldOnly,
        fieldTypes: input.fieldTypes,
      } satisfies AxFormSpec;
      break;
    }
    case 'AxSecurityPrivilege': {
      spec = {
        name: input.name, label: lbl,
        entryPoints: (input.entryPoints ?? []) as EntryPointDef[],
      } satisfies AxPrivilegeSpec;
      break;
    }
    case 'AxSecurityDuty': {
      spec = { name: input.name, label: lbl, privileges: input.privileges } satisfies AxDutySpec;
      break;
    }
    case 'AxSecurityRole': {
      spec = {
        name: input.name, label: lbl, description: input.description,
        duties: input.duties, privileges: input.privileges,
      } satisfies AxRoleSpec;
      break;
    }
    case 'AxMenuItemDisplay':
    case 'AxMenuItemAction':
    case 'AxMenuItemOutput': {
      const kind = input.type.replace('AxMenuItem', '') as 'Display' | 'Action' | 'Output';
      spec = {
        name: input.name, kind, label: lbl,
        object: input.object, objectType: input.objectType,
        parameters: input.parameters, helpText: input.helpText,
      } satisfies AxMenuItemSpec;
      break;
    }
    case 'AxMenu': {
      spec = {
        name: input.name,
        label: lbl,
        menuItems: (input.elements ?? []).map(el => ({
          name: el.menuItemName,
          menuItemType: el.menuItemType ?? 'Display',
        })),
      } satisfies AxMenuSpec;
      break;
    }
    case 'AxMenuExtension': {
      spec = {
        name: input.name,
        elements: (input.elements ?? []) as MenuExtensionElementDef[],
      } satisfies AxMenuExtensionSpec;
      break;
    }
    case 'AxTableExtension': {
      spec = {
        name: input.name,
        fields: (input.fields ?? []) as AxTableExtensionSpec['fields'],
        fieldGroups: input.fieldGroups, relations: input.relations as AxTableExtensionSpec['relations'],
        indexes: input.indexes,
      } satisfies AxTableExtensionSpec;
      break;
    }
    default:
      return `Unsupported type: ${input.type}`;
  }

  const xml      = handler.generate(spec);
  const fp       = registry.getAotPath(input.model, canonicalFolder(input.type), input.name);
  const result   = writer.writeObject(fp, xml, input.type, input.name);

  const lines = [`✅ ${result.created ? 'Created' : 'Updated'}: ${result.path}`];
  if (useLbls && lbl?.startsWith('@')) {
    const ldir = path.join(registry['packagesRoot'], model.packageFolder, model.name, 'AxLabelFile');
    lines.push(`📄 Labels: ${ldir}`);
  }
  lines.push('', 'Next steps:');
  lines.push(`  1. Review: ${result.path}`);
  lines.push(`  2. Compile: d365_build { action:"compile", model:"${input.model}" }`);
  lines.push(`  3. Sync DB: d365_build { action:"sync_db", model:"${input.model}" }`);
  return lines.join('\n');
}
