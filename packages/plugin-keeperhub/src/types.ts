export interface KeeperHubApiResponse {
  tx_hash: string;
  signed_receipt: string;
  status: "pending" | "confirmed" | "failed";
}

export interface WorkflowReceipt {
  txHash: string;
  signedReceipt: string;
  status: "pending" | "confirmed" | "failed";
}

export interface PayWorkflowParams {
  workflowId: string;
  amount: string;
  currency: string;
  fromWallet: string;
  callerEns: string;
}

export interface ExecuteWorkflowParams {
  workflowId: string;
  params: Record<string, unknown>;
  auditTag: string;
}

export interface KeeperHubConfig {
  apiKey: string;
  baseUrl: string;
}
