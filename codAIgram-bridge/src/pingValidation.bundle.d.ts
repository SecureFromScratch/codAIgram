import type { Result } from "neverthrow";
export interface ValidatedRequest {
    readonly type: string;
    readonly id: string;
    readonly targetId?: string;
}
export function validateRequest(text: string): Promise<Result<ValidatedRequest, string>>;
