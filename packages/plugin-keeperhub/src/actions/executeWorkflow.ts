import type { Action, IAgentRuntime, Memory, HandlerCallback, State } from "@elizaos/core";
import type { ExecuteWorkflowParams } from "../types.js";
import { makeValidate, resolveService, handleError } from "./_helpers.js";

export const executeWorkflowAction: Action = {
  name: "EXECUTE_WORKFLOW",
  similes: ["RUN_WORKFLOW", "EXECUTE_SETTLEMENT", "TRIGGER_WORKFLOW"],
  description:
    "Execute a KeeperHub workflow for settlement. Provide params.workflowId, params.params, params.auditTag in options.",

  validate: makeValidate([["execute", "run", "trigger"], ["workflow", "settlement"]]),

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const params = options?.params as ExecuteWorkflowParams | undefined;
    if (!params?.workflowId) {
      await callback?.({
        text: "EXECUTE_WORKFLOW requires options.params with workflowId, params, and auditTag.",
      });
      return false;
    }

    try {
      const receipt = await resolveService(runtime).executeWorkflow(params);
      await callback?.({
        text: `Workflow executed. tx=${receipt.txHash} status=${receipt.status}`,
        action: "EXECUTE_WORKFLOW",
        receipt,
      });
      return true;
    } catch (err) {
      return handleError(err, "EXECUTE_WORKFLOW", callback);
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Execute settlement workflow bella/booking-deposit" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Workflow executed. tx=0xsettle123 status=confirmed",
          action: "EXECUTE_WORKFLOW",
        },
      },
    ],
  ],
};
