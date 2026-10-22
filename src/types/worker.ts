// src/types/worker.ts

export type WorkerCommand = 
  | 'GENERATE_WALLET'
  | 'ENCRYPT_VAULT'
  | 'DECRYPT_VAULT'
  | 'SIGN_TRANSACTION';

export interface WorkerMessage<T = unknown> {
  id: string;
  command: WorkerCommand;
  payload?: T;
}

export interface WorkerResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface EncryptPayload {
  secret: string; 
  password: string;
}

// Strictly typing the vault structure for Phase 3
export interface EncryptedVault {
  iv: string;
  salt: string;
  data: string;
}

export interface DecryptPayload {
  encryptedVault: EncryptedVault; 
  password: string;
}

export interface SignTxPayload {
  encryptedVault: EncryptedVault;
  password: string;
  unsignedTx: Record<string, unknown>; // Standard replacement for generic objects
}