import { registerStopCase } from "./codexStop.case";
import { registerStopFailureCase } from "./codexStopFailure.case";

suite("Codex child shutdown", () => {
    registerStopCase();
    registerStopFailureCase();
});
