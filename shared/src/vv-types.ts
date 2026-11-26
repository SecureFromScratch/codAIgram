import { PublicDisclosure, ValidatedRegex, PUBLIC, vv } from '@untrust/vv/zod';

export class CodingIdentifier extends ValidatedRegex<PublicDisclosure> {
  public constructor(value: string) { super(value, 1, 100, PUBLIC); }
  
  protected regexp() { return /^[a-zA-Z_][a-zA-Z0-9_]*$/; }
  protected validityDescription() { return "Must start with a letter or underscore and contain only letters, digits, and underscores."; }
}

export const vv_CodingIdentifier = vv.val(CodingIdentifier);
