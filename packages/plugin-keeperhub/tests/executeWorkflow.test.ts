import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeWorkflowAction } from "../src/actions/executeWorkflow.js";
import type { ExecuteWorkflowParams, WorkflowReceipt } from "../src/types.js";

const MOCK_RECEIPT: WorkflowReceipt = {
  txHash: "0xsettle",
  signedReceipt: "sig_settle",
  status: "confirmed",
};

const mockService = {
  executeWorkflow: vi.fn<[ExecuteWorkflowParams], Promise<WorkflowReceipt>>(),
};

const makeRuntime = () =>
  ({ getService: vi.fn().mockReturnValue(mockService) } as any);

const makeMessage = (text: string) => ({ content: { text } } as any);

describe("EXECUTE_WORKFLOW action", () => {
  beforeEach(() => mockService.executeWorkflow.mockReset());

  describe("validate", () => {
    it("returns true when message contains 'execute' and 'workflow' and service loaded", async () => {
      const valid = await executeWorkflowAction.validate(
        makeRuntime(),
        makeMessage("execute workflow bella/booking-deposit")
      );
      expect(valid).toBe(true);
    });

    it("returns false when service is not loaded", async () => {
      const runtime = { getService: vi.fn().mockReturnValue(null) } as any;
      const valid = await executeWorkflowAction.validate(
        runtime,
        makeMessage("execute workflow x")
      );
      expect(valid).toBe(false);
    });

    it("returns false for unrelated messages", async () => {
      const valid = await executeWorkflowAction.validate(
        makeRuntime(),
        makeMessage("book a table for friday")
      );
      expect(valid).toBe(false);
    });
  });

  describe("handler", () => {
    it("calls executeWorkflow with params from options", async () => {
      mockService.executeWorkflow.mockResolvedValueOnce(MOCK_RECEIPT);
      const callback = vi.fn().mockResolvedValue([]);

      const params: ExecuteWorkflowParams = {
        workflowId: "bella/booking-deposit",
        params: { slot_id: "BELLA-FRI-8PM", amount: "20" },
        auditTag: "session-xyz",
      };

      const result = await executeWorkflowAction.handler(
        makeRuntime(),
        makeMessage("execute workflow"),
        undefined,
        { params },
        callback
      );

      expect(result).toBe(true);
      expect(mockService.executeWorkflow).toHaveBeenCalledWith(params);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("0xsettle") })
      );
    });

    it("returns false when params.workflowId is missing", async () => {
      const callback = vi.fn().mockResolvedValue([]);
      const result = await executeWorkflowAction.handler(
        makeRuntime(),
        makeMessage("execute"),
        undefined,
        { params: { params: {}, auditTag: "x" } },
        callback
      );
      expect(result).toBe(false);
    });

    it("returns false and calls callback with error on service failure", async () => {
      mockService.executeWorkflow.mockRejectedValueOnce(new Error("timeout"));
      const callback = vi.fn().mockResolvedValue([]);

      const result = await executeWorkflowAction.handler(
        makeRuntime(),
        makeMessage("execute"),
        undefined,
        {
          params: {
            workflowId: "x",
            params: {},
            auditTag: "t",
          } satisfies ExecuteWorkflowParams,
        },
        callback
      );

      expect(result).toBe(false);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ text: expect.stringContaining("timeout") })
      );
    });
  });
});
