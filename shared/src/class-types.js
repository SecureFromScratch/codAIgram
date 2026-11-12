import { JsonMap } from '#shared/json-map';
export function isClassDetails(value) {
    // UNTRUST-ALLOW-NULLISH: JSON and persisted boundaries may contain null, which must be excluded before checking the fixed fields of a candidate class-details value.
    return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'isPartial' in value && typeof value.isPartial === 'boolean' && 'methods' in value && Array.isArray(value.methods) && value.methods.every(isClassMember) && 'relations' in value && Array.isArray(value.relations) && value.relations.every(isClassRelation);
}
export function isClassMember(value) {
    // UNTRUST-ALLOW-NULLISH: A class-member value arrives from JSON or persistence and may be null, so reject it before inspecting its required name and overload fields.
    return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && 'overloads' in value && Array.isArray(value.overloads) && value.overloads.every((overload) => Array.isArray(overload) && overload.every(isFieldType));
}
export function isFieldType(value) {
    // UNTRUST-ALLOW-NULLISH: A field descriptor at an untrusted boundary may be null, so reject it before safely validating its argument name and composable type.
    return typeof value === 'object' && value !== null && 'arg' in value && typeof value.arg === 'string' && 't' in value && isCompositeType(value.t);
}
export function isCompositeType(value) {
    if (Array.isArray(value))
        return value.every((item) => typeof item === 'string');
    // UNTRUST-ALLOW-NULLISH: A recursive composite value may be null in untrusted JSON or stored data, so it must be excluded before recursing through object children.
    return typeof value === 'string' || typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(isCompositeType);
}
export function isClassRelation(value) {
    // UNTRUST-ALLOW-NULLISH: A relation from an untrusted JSON or persisted document may be null, so reject it before validating its closed kind and required fields.
    return typeof value === 'object' && value !== null && 'kind' in value && (value.kind === 'OWNS' || value.kind === 'REF' || value.kind === 'UNK') && 'name' in value && typeof value.name === 'string' && 'target' in value && typeof value.target === 'string' && 'many' in value && typeof value.many === 'boolean';
}
export function parseClassDetails(value, onInvalidInput) {
    if (!isClassDetails(value))
        return onInvalidInput(new Error('Invalid class details.'));
    const details = value;
    return {
        name: details.name,
        relations: details.relations,
        isPartial: details.isPartial,
        methods: details.methods.map((member) => ({
            name: member.name,
            overloads: member.overloads.map((args) => args.map((field) => ({
                arg: field.arg,
                t: parseCompositeType(field.t, onInvalidInput)
            })))
        }))
    };
}
function parseCompositeType(value, onInvalidInput) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
        return value;
    return JsonMap.fromJson(value, (name) => name, (child) => parseCompositeType(child, onInvalidInput), onInvalidInput);
}
