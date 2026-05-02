import type { IAgentRuntime, Memory, HandlerCallback } from "@elizaos/core";
import type { KeeperHubService } from "../service.js";
import { KEEPERHUB_SERVICE_TYPE } from "../service.js";

export function makeValidate(
  keywords: string[][]
): (runtime: IAgentRuntime, message: Memory) => Promise<boolean> {
  return async (runtime, message) => {
    const text = ((message.content as { text?: string }).text ?? "").toLowerCase();
    const hasKeywords = keywords.every((group) => group.some((kw) => text.includes(kw)));
    return hasKeywords && !!runtime.getService(KEEPERHUB_SERVICE_TYPE as any);
  };
}

export function resolveService(runtime: IAgentRuntime): KeeperHubService {
  return runtime.getService(KEEPERHUB_SERVICE_TYPE as any) as unknown as KeeperHubService;
}

export async function handleError(
  err: unknown,
  actionName: string,
  callback: HandlerCallback | undefined
): Promise<false> {
  const msg = err instanceof Error ? err.message : String(err);
  await callback?.({ text: `${actionName} failed: ${msg}` });
  return false;
}
