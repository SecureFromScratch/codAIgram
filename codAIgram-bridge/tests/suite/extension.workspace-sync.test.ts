import { registerWorkspaceSyncIntegrationCase } from "./extension.workspace-sync.case";
import type { BridgeApi } from "./extension.helpers";

export function registerWorkspaceSyncIntegration(getApi: () => BridgeApi): void {
  registerWorkspaceSyncIntegrationCase(getApi);
}
