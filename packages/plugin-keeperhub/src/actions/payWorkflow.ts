import type { Action, IAgentRuntime, Memory, HandlerCallback, State } from "@elizaos/core";
import type { PayWorkflowParams } from "../types.js";
import { makeValidate, resolveService, handleError } from "./_helpers.js";

export const payWorkflowAction: Action = {
  name: "PAY_WORKFLOW",
  similes: ["PAY_TOLL", "PAY_INBOUND_TOLL", "EXECUTE_PAYMENT"],
  description:
    "Pay a KeeperHub workflow toll. Provide params.workflowId, params.amount, params.currency, params.fromWallet, params.callerEns in options.",

  validate: makeValidate([["pay"], ["toll", "workflow", "payment"]]),

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const params = options?.params as PayWorkflowParams | undefined;
    if (!params?.workflowId) {
      await callback?.({
        text: "PAY_WORKFLOW requires options.params with workflowId, amount, currency, fromWallet, callerEns.",
      });
      return false;
    }

    try {
      const receipt = await resolveService(runtime).payWorkflow(params);
      await callback?.({
        text: `Toll paid. tx=${receipt.txHash} status=${receipt.status}`,
        action: "PAY_WORKFLOW",
        receipt,
      });
      return true;
    } catch (err) {
      return handleError(err, "PAY_WORKFLOW", callback);
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Pay toll 0.25 USDC for workflow bella/inbound-toll from alex.eth" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Toll paid. tx=0xdeadbeef status=confirmed",
          action: "PAY_WORKFLOW",
        },
      },
    ],
  ],
};
