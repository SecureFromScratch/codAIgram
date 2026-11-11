export interface ClassDetails {
  name: string;
  methods: string[];
  relations: {
    kind: 'OWNS';
    name: string;
    target: string;
    // UNTRUST-ALLOW-BOOLEAN: The existing HTTP and Firestore class-details contract encodes relation multiplicity as a boolean; changing that wire shape would break existing clients and stored documents.
    many: boolean }[];
  // UNTRUST-ALLOW-BOOLEAN: The existing HTTP and Firestore class-details contract encodes partial status as a boolean; changing that wire shape would break existing clients and stored documents.
  isPartial: boolean;
}
export interface ClassRepository {
  getDetails(names: readonly string[]): Promise<ClassDetails[]>;
  updateClasses(classes: readonly ClassDetails[]): Promise<void>;
}
