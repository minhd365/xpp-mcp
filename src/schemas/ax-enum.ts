import { EnumSpec } from './types';
import { rootElement, closeElement } from './namespaces';

/**
 * Generate a complete AxEnum XML string.
 * Confirmed correct from live D365 F&O 10.37 filesystem scan.
 */
export function generateEnum(spec: EnumSpec): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push(rootElement('AxEnum'));

  lines.push(`\t<Name>${spec.name}</Name>`);
  if (spec.label) {
    lines.push(`\t<Label>${spec.label}</Label>`);
  }
  if (spec.helpText) {
    lines.push(`\t<HelpText>${spec.helpText}</HelpText>`);
  }

  lines.push('\t<EnumValues>');
  for (const v of spec.values) {
    lines.push('\t\t<AxEnumValue>');
    lines.push(`\t\t\t<Name>${v.name}</Name>`);
    if (v.label) {
      lines.push(`\t\t\t<Label>${v.label}</Label>`);
    }
    lines.push(`\t\t\t<Value>${v.value}</Value>`);
    lines.push('\t\t</AxEnumValue>');
  }
  lines.push('\t</EnumValues>');

  lines.push(closeElement('AxEnum'));
  return lines.join('\n');
}
