import { JsonMap } from '#shared/json-map';
export interface ClassDetails {
    name: string;
    methods: ClassMember[];
    relations: {
        kind: 'OWNS' | 'REF' | 'UNK';
        name: string;
        target: string;
        many: boolean;
    }[];
    isPartial: boolean;
}
export interface ClassMember {
    name: string;
    overloads: ArgsListT[];
}
export interface FieldType {
    arg: string;
    t: CompositeTypeT;
}
export type ArgsListT = FieldType[];
export type EnumValuesT = string[];
export type TypeNameT = string;
export type NamedTupleT = JsonMap<string, CompositeTypeT>;
export type CompositeTypeT = TypeNameT | EnumValuesT | NamedTupleT;
export declare function isClassDetails(value: unknown): boolean;
export declare function isClassMember(value: unknown): boolean;
export declare function isFieldType(value: unknown): boolean;
export declare function isCompositeType(value: unknown): boolean;
export declare function isClassRelation(value: unknown): boolean;
export declare function parseClassDetails(value: unknown, onInvalidInput: (error: Error) => never): ClassDetails;
