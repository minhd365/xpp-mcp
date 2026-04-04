/**
 * XML namespace map per object type.
 * Ground truth confirmed from live scan of 100k+ objects in Foundation model.
 *
 * Three namespace groups:
 *   A = xmlns:i only            (Table, Class, Enum, Security, Map, Extensions)
 *   B = xmlns:i + xmlns=""      (EDT, Query — typed root with i:type)
 *   C = xmlns:i + V1            (MenuItems, MenuExtension)
 *   D = xmlns:i + V6            (Form, FormExtension)
 */

export const XI = 'xmlns:i="http://www.w3.org/2001/XMLSchema-instance"';
export const V1 = 'xmlns="Microsoft.Dynamics.AX.Metadata.V1"';
export const V6 = 'xmlns="Microsoft.Dynamics.AX.Metadata.V6"';

/** Returns the opening root element line for a given AOT object type. */
export function rootElement(objectType: string, iType?: string): string {
  switch (objectType) {
    // Group A — xmlns:i only
    case 'AxTable':
    case 'AxClass':
    case 'AxEnum':
    case 'AxDataEntityView':
    case 'AxSecurityPrivilege':
    case 'AxSecurityDuty':
    case 'AxSecurityRole':
    case 'AxTableExtension':
    case 'AxMap':
    case 'AxView':
    case 'AxLabelFile':
      return `<${objectType} ${XI}>`;

    // Group B — xmlns:i + xmlns="" + i:type on root (EDT, Query)
    case 'AxEdt':
    case 'AxQuery':
      return `<${objectType} ${XI} xmlns=""\n\ti:type="${iType ?? objectType}">`;

    // Group C — V1 namespace (menu items and extensions)
    case 'AxMenuItemDisplay':
    case 'AxMenuItemAction':
    case 'AxMenuItemOutput':
    case 'AxMenuExtension':
    case 'AxMenu':
      return `<${objectType} ${XI}\n\t${V1}>`;

    // Group D — V6 namespace (forms)
    case 'AxForm':
    case 'AxFormExtension':
      return `<${objectType} ${XI}\n\t${V6}>`;

    default:
      // Fallback: xmlns:i only
      return `<${objectType} ${XI}>`;
  }
}

/** Closing root tag for any object type */
export function closeElement(objectType: string): string {
  return `</${objectType}>`;
}

/**
 * AOT folder names — canonical Pascal case to use when CREATING folders.
 * Note: On disk, some standard models use lowercase (axsecurityduty, axsecurityrole).
 * Windows is case-insensitive for reads, but always create with canonical casing.
 */
export const AOT_FOLDER_CANONICAL: Record<string, string> = {
  axtable:             'AxTable',
  axclass:             'AxClass',
  axenum:              'AxEnum',
  axedt:               'AxEdt',
  axform:              'AxForm',
  axquery:             'AxQuery',
  axdataentityview:    'AxDataEntityView',
  axmenuitemdisplay:   'AxMenuItemDisplay',
  axmenuitemaction:    'AxMenuItemAction',
  axmenuitemoutput:    'AxMenuItemOutput',
  axmenuextension:     'AxMenuExtension',
  axmenu:              'AxMenu',
  axsecurityprivilege: 'AxSecurityPrivilege',
  axsecurityduty:      'AxSecurityDuty',
  axsecurityrole:      'AxSecurityRole',
  axlabelfile:         'AxLabelFile',
  axtableextension:    'AxTableExtension',
  axformextension:     'AxFormExtension',
  axmap:               'AxMap',
  axview:              'AxView',
};

export function canonicalFolder(objectType: string): string {
  return AOT_FOLDER_CANONICAL[objectType.toLowerCase()] ?? objectType;
}
