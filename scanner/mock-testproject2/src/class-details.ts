import { JsonMap } from './json-map.js';

export interface ClassDetails {
  name: string;
  usage: 'ex'|'dto'|undefined;
  sourceFile?: string;
  modifiedAt: string;
  relations: {
    kind: 'OWNS' | 'REF';
    name: string; // this is a comment
    many: '1'|'*'|'+' }[]; // another comment
  state?: string;
}
