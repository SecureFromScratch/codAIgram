export interface TaskContract {
  task: Task;
  options: {
    format: string;
    limits: {
      // this is a comment to ensure comments are ignored
      limitType: 'none' | 'count' | 'size';
      maximum: number;
    };
  };
  describe(format: string): string;
}

export interface AssigneeContract {}

export interface Queue<T> {}
