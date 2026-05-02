import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KeeperHubService } from "../src/service.js";
import type { PayWorkflowParams, ExecuteWorkflowParams } from "../src/types.js";

const MOCK_RUNTIME = {
  getSetting: (key: string) => {
    if (key === "KEEPERHUB_API_KEY") return "test-api-key";
    if (key === "KEEPERHUB_BASE_URL") return "https://api.keeperhub.com";
    return undefined;
  },
} as any;

const CONFIRMED_RECEIPT = {
  tx_hash: "0xdeadbeef",
  signed_receipt: "sig_abc123",
  status: "confirmed",
};

describe("KeeperHubService", () => {
  let service: KeeperHubService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    service = new KeeperHubService();
    await service.initialize(MOCK_RUNTIME);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("payWorkflow", () => {
    it("calls POST /v1/workflows/pay with correct body and auth header", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => CONFIRMED_RECEIPT,
      } as Response);

      const params: PayWorkflowParams = {
        workflowId: "bella/inbound-toll",
        amount: "0.25",
        currency: "USDC",
        fromWallet: "0xAlexWallet",
        callerEns: "alex.eth",
      };

      await service.payWorkflow(params);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.keeperhub.com/v1/workflows/pay");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        workflow_id: "bella/inbound-toll",
        amount: "0.25",
        currency: "USDC",
        from: "0xAlexWallet",
        metadata: { purpose: "inbound_channel", caller_ens: "alex.eth" },
      });
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test-api-key");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("returns a WorkflowReceipt with camelCase fields", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => CONFIRMED_RECEIPT,
      } as Response);

      const receipt = await service.payWorkflow({
        workflowId: "bella/inbound-toll",
        amount: "0.25",
        currency: "USDC",
        fromWallet: "0xAlexWallet",
        callerEns: "alex.eth",
      });

      expect(receipt).toEqual({
        txHash: "0xdeadbeef",
        signedReceipt: "sig_abc123",
        status: "confirmed",
      });
    });

    it("throws when the API returns a non-ok status", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      } as Response);

      await expect(
        service.payWorkflow({
          workflowId: "x",
          amount: "1",
          currency: "USDC",
          fromWallet: "0x0",
          callerEns: "a.eth",
        })
      ).rejects.toThrow("KeeperHub API error 401");
    });
  });

  describe("executeWorkflow", () => {
    it("calls POST /v1/workflows/execute with correct body", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => CONFIRMED_RECEIPT,
      } as Response);

      const params: ExecuteWorkflowParams = {
        workflowId: "bella/booking-deposit",
        params: { slot_id: "BELLA-FRI-8PM", amount: "20", terms_hash: "0xterms" },
        auditTag: "tollgate-session-abc",
      };

      await service.executeWorkflow(params);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.keeperhub.com/v1/workflows/execute");
      expect(JSON.parse(init.body as string)).toEqual({
        workflow_id: "bella/booking-deposit",
        params: { slot_id: "BELLA-FRI-8PM", amount: "20", terms_hash: "0xterms" },
        audit_tag: "tollgate-session-abc",
      });
    });

    it("throws when the API returns a non-ok status", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => "Payment Required",
      } as Response);

      await expect(
        service.executeWorkflow({ workflowId: "x", params: {}, auditTag: "t" })
      ).rejects.toThrow("KeeperHub API error 402");
    });

    it("returns WorkflowReceipt with status 'pending' when API returns pending", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tx_hash: "0xpending", signed_receipt: "", status: "pending" }),
      } as Response);

      const receipt = await service.executeWorkflow({
        workflowId: "bella/booking-deposit",
        params: {},
        auditTag: "tag",
      });

      expect(receipt.status).toBe("pending");
      expect(receipt.txHash).toBe("0xpending");
    });
  });
});
