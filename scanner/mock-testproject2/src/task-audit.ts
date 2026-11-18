export interface TaskAudit {
  actor: AssigneeContract;
  action: string;
  recordedAt: string;
}

export class TaskAuditLog {
  readonly entries: TaskAudit[] = [];

  record(entry: TaskAudit): void {
    this.entries.push(entry);
  }
}
