// Shared TypeScript interfaces — all schemas and tools.
// Ground truth from live scan of C:\AOSService\PackagesLocalDirectory.

// ─── Model ───────────────────────────────────────────────────────────────────

export interface ModelInfo {
  name: string;           // <Name> from descriptor = inner AOT folder
  packageFolder: string;  // <ModelModule> = top-level folder
  id: number;
  layer: number;          // 0=sys 8=isv 10=usr
  publisher: string;
  dependencies: string[];
  isCustom: boolean;
  descriptorPath: string;
}

// ─── Field / Table ───────────────────────────────────────────────────────────

export type FieldType =
  | 'String' | 'Int' | 'Int64' | 'Real' | 'Date'
  | 'DateTime' | 'Enum' | 'Guid' | 'Container' | 'Time';

export type TableGroup =
  | 'Main' | 'Group' | 'Parameter' | 'Reference'
  | 'Transaction' | 'TransactionHeader' | 'TransactionLine'
  | 'WorksheetHeader' | 'WorksheetLine' | 'Worksheet' | 'Staging';

export type CacheLookup = 'NotInTTS' | 'Found' | 'EntireTable' | 'FoundAndEmpty';
export type DeleteActionType = 'Restricted' | 'Cascade' | 'None';

export interface FieldDef {
  name: string;
  fieldType: FieldType;
  label?: string;
  helpText?: string;
  edt?: string;
  enumType?: string;
  mandatory?: boolean;
  allowEdit?: boolean;
  allowEditOnCreate?: boolean;
  saveContents?: boolean;
  visible?: boolean;
  null?: boolean;
}

export interface IndexDef {
  name: string;
  fields: string[];
  unique?: boolean;
  clustered?: boolean;
  allowPageLocks?: boolean;
}

export interface RelationConstraintDef {
  name: string;
  field: string;
  relatedField: string;
}

export interface RelationDef {
  name: string;
  relatedTable: string;
  constraints: RelationConstraintDef[];
  onDelete?: DeleteActionType;
  cardinality?: string;
  relatedTableCardinality?: string;
  relationshipType?: string;
  role?: string;
  relatedTableRole?: string;
}

export interface DeleteActionDef {
  table: string;
  action: DeleteActionType;
}

export interface FieldGroupDef {
  name: string;
  fields: string[];
  label?: string;
}

export interface MethodDef {
  name: string;
  source: string;
}

export interface TableSpec {
  name: string;
  model: string;
  label?: string;
  helpText?: string;
  developerDocumentation?: string;
  tableGroup?: TableGroup;
  cacheLookup?: CacheLookup;
  saveDataPerCompany?: boolean;
  primaryIndex?: string;
  titleField1?: string;
  titleField2?: string;
  modules?: string;
  fields?: FieldDef[];
  indexes?: IndexDef[];
  relations?: RelationDef[];
  deleteActions?: DeleteActionDef[];
  fieldGroups?: FieldGroupDef[];
  methods?: MethodDef[];
  classDeclaration?: string;
  useLabels?: boolean;
}

// ─── Class ───────────────────────────────────────────────────────────────────

export interface ClassSpec {
  name: string;
  model: string;
  label?: string;
  classDeclaration: string;
  methods?: MethodDef[];
}

// ─── Enum ────────────────────────────────────────────────────────────────────

export interface EnumValueDef {
  name: string;
  label?: string;
  value: number;
}

export interface EnumSpec {
  name: string;
  model: string;
  label?: string;
  helpText?: string;
  values: EnumValueDef[];
  useLabels?: boolean;
}

// ─── EDT ─────────────────────────────────────────────────────────────────────

export type EdtType =
  | 'String' | 'Int' | 'Int64' | 'Real' | 'Date'
  | 'DateTime' | 'Enum' | 'Guid' | 'Container' | 'Time';

export interface EdtSpec {
  name: string;
  model: string;
  edtType: EdtType;
  label?: string;
  helpText?: string;
  extends?: string;
  stringSize?: number;
  enumType?: string;
  referenceTable?: string;
  allowNegative?: boolean;
  useLabels?: boolean;
}

// ─── Form ────────────────────────────────────────────────────────────────────

export interface FormDataSourceDef {
  name?: string;
  table: string;
  fields?: string[];
  joinSource?: string;
  linkType?: 'OuterJoin' | 'InnerJoin' | 'ExistsJoin' | 'ActiveLink' | 'DelayedLink';
  insertIfEmpty?: boolean;
  allowCreate?: boolean;
}

export interface FastTabDef {
  caption: string;
  fields: string[];
}

export interface ActionButtonDef {
  name: string;
  command?: string;
  menuItem?: string;
  label?: string;
}

// ─── Security ────────────────────────────────────────────────────────────────

export interface EntryPointGrantDef {
  read?: string;
  create?: string;
  update?: string;
  delete?: string;
  correct?: string;
}

export interface EntryPointFormDef {
  name: string;
}

export interface EntryPointDef {
  menuItem: string;
  objectType?: string;
  grants?: EntryPointGrantDef;
  forms?: EntryPointFormDef[];
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export interface MenuExtensionElementDef {
  parent?: string;
  menuItemName: string;
  menuItemType?: 'Display' | 'Action' | 'Output' | 'MenuReference';
}

// ─── Write result ─────────────────────────────────────────────────────────────

export interface WriteResult {
  path: string;
  objectType: string;
  objectName: string;
  created: boolean;
  additionalFiles?: string[];
}
