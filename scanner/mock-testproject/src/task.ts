export class ChildTask {}

export class Task {
  readonly contract: TaskContract;
  children: ChildTask[];
  assignees: Queue<AssigneeContract>;
  private internalCode: string;

  assign(assignee: AssigneeContract, urgent: boolean): void {}

  get count(): number { return 0; }

  set count(value: number) {}

  lookup(value: string): ChildTask;
  lookup(value: number): ChildTask;
  lookup(value: string | number): ChildTask { return new ChildTask(); }
}
