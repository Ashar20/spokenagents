import { describe, it, expect, vi, beforeEach } from "vitest";
import { payWorkflowAction } from "../src/actions/payWorkflow.js";
import type { PayWorkflowParams, WorkflowReceipt } from "../src/types.js";

const MOCK_RECEIPT: WorkflowReceipt = {
  txHash: "0xabc",
  signedReceipt: "sig",
  status: "confirmed",
};

const mockService = {
  payWorkflow: vi.fn<[PayWorkflowParams], Promise<WorkflowReceipt>>(),
};

const makeRuntime = () =>
  ({
    getService: vi.fn().mockReturnValue(mockService),
  } as any);

const makeMessage = (text: string) =>
  ({ content: { text } } as any);

describe("PAY_WORKFLOW action", () => {
  beforeEach(() => {
    mockService.payWorkflow.mockReset();
  });

  describe("validate", () => {
    it("returns true when message contains 'pay' and 'toll' and service is loaded", async () => {
      const runtime = makeRuntime();
      const valid = await payWorkflowAction.validate(
        runtime,
        makeMessage("pay toll to bella.eth")
      );
      expect(valid).toBe(true);
    });

    it("returns false when service is not loaded", async () => {
      const runtime = { getService: vi.fn().mockReturnValue(null) } as any;
      const valid = await payWorkflowAction.validate(
        runtime,
        makeMessage("pay toll")
      );
      expect(valid).toBe(false);
    });

    it("returns false when message has no payment keywords", async () => {
      const runtime = makeRuntime();
      const valid = await payWorkflowAction.validate(
        runtime,
        makeMessage("book a table at bella")
      );
      expect(valid).toBe(false);
    });
  });

  describe("handler", () => {
    it("calls payWorkflow with params from options and invokes callback with receipt", async () => {
      mockService.payWorkflow.mockResolvedValueOnce(MOCK_RECEIPT);
      const runtime = makeRuntime();
      const callback = vi.fn().mockResolvedValue([]);

      const params: PayWorkflowParams = {
        workflowId: "bella/inbound-toll",
        amount: "0.25",
        currency: "USDC",
        fromWallet: "0xAlex",
        callerEns: "alex.eth",
      };

      const result = await payWorkflowAction.handler(
        runtime,
        makeMessage("pay toll"),
        undefined,
        { params },
        callback
      );

      expect(result).toBe(true);
      expect(mockService.payWorkflow).toHaveBeenCalledWith(params);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("0xabc"),
          action: "PAY_WORKFLOW",
        })
      );
    });

    it("returns false and calls callback with error when service throws", async () => {
      mockService.payWorkflow.mockRejectedValueOnce(new Error("Network failure"));
      const runtime = makeRuntime();
      const callback = vi.fn().mockResolvedValue([]);

      const result = await payWorkflowAction.handler(
        runtime,
        makeMessage("pay toll"),
        undefined,
        {
          params: {
            workflowId: "x",
            amount: "1",
            currency: "USDC",
            fromWallet: "0x0",
            callerEns: "a.eth",
          } satisfies PayWorkflowParams,
        },
        callback
      );

      expect(result).toBe(false);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("Network failure") })
      );
    });

    it("returns false when params are missing from options", async () => {
      const runtime = makeRuntime();
      const callback = vi.fn().mockResolvedValue([]);

      const result = await payWorkflowAction.handler(
        runtime,
        makeMessage("pay toll"),
        undefined,
        {},
        callback
      );

      expect(result).toBe(false);
    });
  });
});
