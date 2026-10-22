// src/workers/wallet.worker.ts
import type { WorkerMessage, WorkerResponse, EncryptPayload, DecryptPayload, EncryptedVault, SignTxPayload } from '../types/worker';
import { generateMnemonic } from '@scure/bip39';
// Added .js extension to satisfy strict module resolution
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Wallet } from 'ethers';

// --- Session Management ---
let activeSessionSecret: string | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;
const SESSION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function clearSession() {
  activeSessionSecret = null;
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = null;
}

// --- Cryptography Constants & Helpers ---
const KDF_ITERATIONS = 600_000;

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(view)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Simplified to return Uint8Array directly to satisfy Web Crypto APIs
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// --- Core Cryptography Functions ---

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource, // Explicit cast to satisfy strict DOM types
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false, // Strict security: key cannot be extracted from memory
    ['encrypt', 'decrypt']
  );
}

async function encryptSecret(secret: string, password: string): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // Standard 96-bit IV for GCM
  const key = await deriveAesKey(password, salt);
  
  const encoder = new TextEncoder();
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, // Explicit cast
    key,
    encoder.encode(secret)
  );

  return {
    salt: bufferToHex(salt),
    iv: bufferToHex(iv),
    data: bufferToHex(encryptedContent)
  };
}

async function decryptSecret(vault: EncryptedVault, password: string): Promise<string> {
  const salt = hexToUint8Array(vault.salt);
  const iv = hexToUint8Array(vault.iv);
  const encryptedContent = hexToUint8Array(vault.data);
  
  const key = await deriveAesKey(password, salt);
  const decryptedContent = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, // Explicit cast
    key,
    encryptedContent as BufferSource // Explicit cast
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedContent);
}

// --- Message Router ---

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, command, payload } = event.data;

  try {
    let result: unknown;

    switch (command) {
      case 'GENERATE_WALLET': {
        const mnemonic = generateMnemonic(wordlist, 128);
        result = { mnemonic };
        break;
      }

      case 'ENCRYPT_VAULT': {
        const { secret, password } = payload as EncryptPayload;
        
        // Derive the public address based on whether it is a mnemonic or private key
        let address = '';
        if (secret.includes(' ')) {
          address = Wallet.fromPhrase(secret).address;
        } else {
          address = new Wallet(secret).address;
        }

        const encryptedVault = await encryptSecret(secret, password);
        result = { encryptedVault, address };
        break;
      }

      case 'DECRYPT_VAULT': {
        const { encryptedVault, password } = payload as DecryptPayload;
        const secret = await decryptSecret(encryptedVault, password);
        result = { secret };
        break;
      }

      case 'UNLOCK_WALLET': {
        const { encryptedVault, password } = payload as DecryptPayload;
        const secret = await decryptSecret(encryptedVault, password);
        activeSessionSecret = secret;
        
        if (sessionTimer) clearTimeout(sessionTimer);
        sessionTimer = setTimeout(clearSession, SESSION_DURATION_MS);
        
        result = { success: true };
        break;
      }

      case 'LOCK_WALLET': {
        clearSession();
        result = { success: true };
        break;
      }

      case 'GET_PRIVATE_KEY': {
        const { encryptedVault, password } = payload as DecryptPayload;
        
        let secretToExtract = activeSessionSecret;
        if (!secretToExtract) {
          if (!password) throw new Error("Password required to view private key");
          secretToExtract = await decryptSecret(encryptedVault, password);
        }
        
        const wallet = secretToExtract.includes(' ') 
          ? Wallet.fromPhrase(secretToExtract) 
          : new Wallet(secretToExtract);
          
        result = { privateKey: wallet.privateKey };
        secretToExtract = ''; // Clear temporary variable
        break;
      }

      case 'SIGN_TRANSACTION': {
        const { encryptedVault, password, unsignedTx } = payload as SignTxPayload;
        
        // 1. Use the active session, or fallback to the provided password
        let secret = activeSessionSecret;
        if (!secret) {
          if (!password) throw new Error("Wallet is locked. Session expired.");
          secret = await decryptSecret(encryptedVault, password);
        }
        
        // 2. Instantiate the isolated Wallet
        const wallet = secret.includes(' ') 
          ? Wallet.fromPhrase(secret) 
          : new Wallet(secret);
        
        // 3. Sign the transaction payload
        const signedTx = await wallet.signTransaction(unsignedTx);
        
        result = { signedTx };
        
        // Proactively clear memory if we aren't using a cached session
        if (!activeSessionSecret) secret = ''; 
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    sendResponse({ id, success: true, data: result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ id, success: false, error: errorMessage });
  } finally {
    // Proactive memory management
    if (payload && typeof payload === 'object') {
      const safePayload = payload as Record<string, unknown>;
      Object.keys(safePayload).forEach(key => {
        safePayload[key] = undefined;
      });
    }
  }
};

function sendResponse(response: WorkerResponse) {
  self.postMessage(response);
}