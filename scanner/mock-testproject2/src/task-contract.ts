export interface TaskContract {
  task: Task;
  title: string;
  summarize(maxLength: number): string;
}

export interface AssigneeContract {}

export interface Queue<T> {}
