import { EdtSpec, EdtType } from './types';
import { XI, closeElement } from './namespaces';

/**
 * Generate a complete AxEdt XML string.
 *
 * EDT namespace pattern (Group B): xmlns:i + xmlns="" + i:type on root element.
 * Confirmed from live D365 F&O 10.37 filesystem scan (13,445 EDT objects in Foundation).
 */
export function generateEdt(spec: EdtSpec): string {
  const lines: string[] = [];
  const iType = edtIType(spec.edtType);

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  // Group B namespace: root has xmlns="" AND i:type
  lines.push(`<AxEdt ${XI} xmlns=""`);
  lines.push(`\ti:type="${iType}">`);

  lines.push(`\t<Name>${spec.name}</Name>`);

  if (spec.extends) {
    lines.push(`\t<Extends>${spec.extends}</Extends>`);
  }
  if (spec.label) {
    lines.push(`\t<Label>${spec.label}</Label>`);
  }
  if (spec.helpText) {
    lines.push(`\t<HelpText>${spec.helpText}</HelpText>`);
  }
  if (spec.referenceTable) {
    lines.push(`\t<ReferenceTable>${spec.referenceTable}</ReferenceTable>`);
  }

  // Always present — required even when empty
  lines.push('\t<ArrayElements />');
  lines.push('\t<Relations />');
  lines.push('\t<TableReferences />');

  // Type-specific extra elements
  switch (spec.edtType) {
    case 'String':
      lines.push(`\t<StringSize>${spec.stringSize ?? 10}</StringSize>`);
      break;
    case 'Int':
      if (spec.allowNegative === false) {
        lines.push(`\t<AllowNegative>No</AllowNegative>`);
      }
      break;
    case 'Real':
      if (spec.allowNegative === false) {
        lines.push(`\t<AllowNegative>No</AllowNegative>`);
      }
      break;
    case 'Date':
      lines.push(`\t<DateDay>None</DateDay>`);
      break;
    case 'DateTime':
      lines.push(`\t<ButtonImage>Calendar</ButtonImage>`);
      break;
    case 'Enum':
      if (spec.enumType) {
        lines.push(`\t<EnumType>${spec.enumType}</EnumType>`);
      }
      break;
  }

  lines.push(closeElement('AxEdt'));
  return lines.join('\n');
}

/** Map EdtType → AxEdt i:type value (all confirmed from live scan) */
export function edtIType(edtType: EdtType): string {
  const map: Record<EdtType, string> = {
    String:    'AxEdtString',
    Int:       'AxEdtInt',
    Int64:     'AxEdtInt64',
    Real:      'AxEdtReal',
    Date:      'AxEdtDate',
    DateTime:  'AxEdtUtcDateTime',
    Enum:      'AxEdtEnum',
    Guid:      'AxEdtGuid',
    Container: 'AxEdtContainer',
    Time:      'AxEdtTime',
  };
  return map[edtType] ?? 'AxEdtString';
}
