export class Subtask {}

export class Task {
  readonly contract: TaskContract;
  children: Subtask[];
  assignees: Queue<AssigneeContract>;
  private internalCode: string;

  assign(assignee: AssigneeContract, priority: number, note: string): void {}

  get count(): number { return 0; }

  set count(value: number) {}

  lookup(value: string, includeArchived: boolean): Subtask;
  lookup(value: number, includeArchived: boolean): Subtask;
  lookup(value: string | number, includeArchived: boolean): Subtask { return new Subtask(); }
}
