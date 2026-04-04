import { generateTable }          from './ax-table';
import { generateForm }           from './ax-form';
import {
  generateClass, generateEnum, generateEdt, generateQuery,
} from './ax-class-enum-edt-query';
import {
  generatePrivilege, generateDuty, generateRole,
  generateMenuItem, generateMenu, generateMenuExtension, generateTableExtension,
} from './ax-security-menu';

export interface SchemaHandler {
  generate: (spec: unknown) => string;
  canModify: boolean;
  description: string;
}

export const SCHEMA_REGISTRY: Record<string, SchemaHandler> = {
  // ── Phase 1 ──────────────────────────────────────────────────────────────
  AxTable: {
    generate: (s) => generateTable(s as Parameters<typeof generateTable>[0]),
    canModify: true,
    description: 'Data table with fields, indexes, relations, field groups',
  },
  AxClass: {
    generate: (s) => generateClass(s as Parameters<typeof generateClass>[0]),
    canModify: true,
    description: 'X++ class with declaration and methods',
  },
  AxEnum: {
    generate: (s) => generateEnum(s as Parameters<typeof generateEnum>[0]),
    canModify: true,
    description: 'Enumeration with labeled values',
  },
  AxEdt: {
    generate: (s) => generateEdt(s as Parameters<typeof generateEdt>[0]),
    canModify: false,
    description: 'Extended Data Type (String/Int/Real/Date/DateTime/Int64/Enum/Guid/Container)',
  },
  AxQuery: {
    generate: (s) => generateQuery(s as Parameters<typeof generateQuery>[0]),
    canModify: false,
    description: 'Query with datasources, ranges, order-by',
  },
  // ── Phase 2 ──────────────────────────────────────────────────────────────
  AxForm: {
    generate: (s) => generateForm(s as Parameters<typeof generateForm>[0]),
    canModify: false,
    description: 'Form — Dialog/SimpleList/SimpleListDetails generated fully; complex patterns scaffolded',
  },
  AxSecurityPrivilege: {
    generate: (s) => generatePrivilege(s as Parameters<typeof generatePrivilege>[0]),
    canModify: false,
    description: 'Security privilege with entry points and grants',
  },
  AxSecurityDuty: {
    generate: (s) => generateDuty(s as Parameters<typeof generateDuty>[0]),
    canModify: false,
    description: 'Security duty referencing privileges',
  },
  AxSecurityRole: {
    generate: (s) => generateRole(s as Parameters<typeof generateRole>[0]),
    canModify: false,
    description: 'Security role referencing duties and privileges',
  },
  AxMenuItemDisplay: {
    generate: (s) => generateMenuItem({ ...(s as object), kind: 'Display' } as Parameters<typeof generateMenuItem>[0]),
    canModify: false,
    description: 'Display menu item pointing to a form',
  },
  AxMenuItemAction: {
    generate: (s) => generateMenuItem({ ...(s as object), kind: 'Action' } as Parameters<typeof generateMenuItem>[0]),
    canModify: false,
    description: 'Action menu item pointing to a class/runnable',
  },
  AxMenuItemOutput: {
    generate: (s) => generateMenuItem({ ...(s as object), kind: 'Output' } as Parameters<typeof generateMenuItem>[0]),
    canModify: false,
    description: 'Output menu item pointing to a report',
  },
  AxMenuExtension: {
    generate: (s) => generateMenuExtension(s as Parameters<typeof generateMenuExtension>[0]),
    canModify: false,
    description: 'Menu extension adding items to an existing standard menu',
  },
  AxMenu: {
    generate: (s) => generateMenu(s as Parameters<typeof generateMenu>[0]),
    canModify: false,
    description: 'Standalone custom top-level menu with menu item references',
  },
  AxTableExtension: {
    generate: (s) => generateTableExtension(s as Parameters<typeof generateTableExtension>[0]),
    canModify: false,
    description: 'Table extension adding fields/relations to a standard table',
  },
};

export function getHandler(objectType: string): SchemaHandler {
  const h = SCHEMA_REGISTRY[objectType];
  if (!h) {
    const available = Object.keys(SCHEMA_REGISTRY).join(', ');
    throw new Error(`Unsupported object type: "${objectType}". Supported: ${available}`);
  }
  return h;
}

export function listSupportedTypes(): string[] {
  return Object.keys(SCHEMA_REGISTRY);
}
