// src/App.tsx
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useWalletWorker } from './hooks/useWalletWorker';
import type { EncryptedVault } from './types/worker';
import { JsonRpcProvider, formatEther, parseEther, Wallet } from 'ethers';
import { useEffect, useState } from 'react';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // If a vault already exists, skip the welcome screen entirely
    if (localStorage.getItem('wallet_vault')) {
      navigate('/dashboard'); 
    }
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700 text-center">
        <h1 className="text-3xl font-bold mb-4">Secure Web3 Wallet</h1>
        <p className="text-slate-400 mb-8">A non-custodial, Web-Worker-isolated Ethereum wallet built for the Sepolia Testnet.</p>
        
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/create')}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Create New Wallet
          </button>
          <button 
            onClick={() => navigate('/import')}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors"
          >
            Import Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateWalletScreen = () => {
  const navigate = useNavigate();
  const { sendCommand } = useWalletWorker();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  
  // NEW: State to hold the phrase for the backup screen
  const [generatedMnemonic, setGeneratedMnemonic] = useState(''); 

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('Generating entropy in Secure Enclave...');

    try {
      const { mnemonic } = await sendCommand<{ mnemonic: string }>('GENERATE_WALLET', {});
      
      setStatus('Encrypting vault...');
      const response = await sendCommand<{ address: string; encryptedVault: EncryptedVault }>('ENCRYPT_VAULT', { 
        secret: mnemonic,
        password 
      });
      
      localStorage.setItem('wallet_address', response.address);
      localStorage.setItem('wallet_vault', JSON.stringify(response.encryptedVault));
      
      // NEW: Show the mnemonic instead of routing immediately
      setGeneratedMnemonic(mnemonic); 
    } catch {
      setError('Generation failed.');
      setStatus('');
    }
  };

  // NEW: The Backup UI that renders after successful creation
  if (generatedMnemonic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
          <h2 className="text-2xl font-bold mb-4 text-center text-green-400">Wallet Created!</h2>
          <p className="text-slate-300 mb-6 text-sm text-center">
            Write down this 12-word recovery phrase. This is your <span className="font-bold text-red-400">ONLY</span> backup. Never share it with anyone.
          </p>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-6">
            <p className="font-mono text-lg text-slate-200 text-center tracking-wide leading-relaxed select-all">
              {generatedMnemonic}
            </p>
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            I have saved my backup phrase
          </button>
        </div>
      </div>
    );
  }

  // The original form UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-center">Create New Wallet</h2>
        <form onSubmit={handleCreate}>
          <input 
            type="password" 
            placeholder="Create a strong password for this device" 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 focus:outline-none focus:border-blue-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          {status && <p className="text-blue-400 text-sm mb-4">{status}</p>}
          
          <button type="submit" className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors mb-3">
            Generate & Encrypt
          </button>
          <button type="button" onClick={() => navigate('/')} className="w-full px-6 py-3 text-slate-400 hover:text-slate-200 text-sm">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

const ImportWalletScreen = () => {
  const navigate = useNavigate();
  const { sendCommand } = useWalletWorker();
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('Validating secret...');

    let formattedSecret = secret.trim();

    // 1. Validate the input (Mnemonic vs Private Key)
    try {
      if (formattedSecret.includes(' ')) {
        Wallet.fromPhrase(formattedSecret); // Throws if invalid mnemonic
      } else {
        if (!formattedSecret.startsWith('0x')) formattedSecret = '0x' + formattedSecret;
        new Wallet(formattedSecret); // Throws if invalid private key
      }
    } catch {
      setError('Invalid Mnemonic Phrase or Private Key.');
      setStatus('');
      return;
    }

    // 2. Send to worker for encryption (adjust command name if yours differs)
    try {
      setStatus('Encrypting in Secure Enclave...');
      // Use ENCRYPT_VAULT instead of IMPORT_WALLET
      const response = await sendCommand<{ address: string; encryptedVault: EncryptedVault }>('ENCRYPT_VAULT', {
        secret: formattedSecret,
        password
      });

      localStorage.setItem('wallet_address', response.address);
      localStorage.setItem('wallet_vault', JSON.stringify(response.encryptedVault));
      
      navigate('/dashboard');
    } catch {
      setError('Encryption failed. Check console.');
      setStatus('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-center">Import Wallet</h2>
        <form onSubmit={handleImport}>
          <textarea 
            placeholder="Enter 12/24-word Mnemonic OR Hex Private Key (0x...)" 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 h-24 resize-none focus:outline-none focus:border-blue-500"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            required
          />
          <input 
            type="password" 
            placeholder="Create a strong password for this device" 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 focus:outline-none focus:border-blue-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          {status && <p className="text-blue-400 text-sm mb-4">{status}</p>}
          
          <button type="submit" className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors mb-3">
            Secure & Import
          </button>
          <button type="button" onClick={() => navigate('/')} className="w-full px-6 py-3 text-slate-400 hover:text-slate-200 text-sm">
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

const DashboardScreen = () => {
  const navigate = useNavigate();
  const { sendCommand } = useWalletWorker();
  
  const [address] = useState<string>(() => localStorage.getItem('wallet_address') || '');
  const [balance, setBalance] = useState<string>('0.0');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Session & Security State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  
  // Transaction State
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  // Private Key Modal State
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [keyPassword, setKeyPassword] = useState<string>('');
  const [revealedKey, setRevealedKey] = useState<string>('');

  useEffect(() => {
    if (!address) {
      navigate('/');
      return;
    }

    const fetchBalance = async () => {
      try {
        const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com', 11155111);
        const balanceWei = await provider.getBalance(address);
        setBalance(formatEther(balanceWei));
      } catch (err) {
        console.error("RPC Connection Error:", err);
        setError('Failed to fetch balance. Check F12 Console.');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [address, navigate]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const vaultString = localStorage.getItem('wallet_vault');
      if (!vaultString) throw new Error('Vault not found.');
      
      await sendCommand('UNLOCK_WALLET', {
        encryptedVault: JSON.parse(vaultString),
        password: unlockPassword
      });
      
      setIsUnlocked(true);
      setUnlockPassword('');
    } catch {
      setError('Invalid password or corrupted vault.');
    }
  };

  const handleLock = async () => {
    await sendCommand('LOCK_WALLET', {});
    setIsUnlocked(false);
    setRevealedKey('');
    setShowKeyModal(false);
  };

  const handleViewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const vaultString = localStorage.getItem('wallet_vault');
      if (!vaultString) throw new Error('Vault not found.');
      
      const response = await sendCommand<{ privateKey: string }>('GET_PRIVATE_KEY', {
        encryptedVault: JSON.parse(vaultString),
        password: keyPassword
      });
      
      setRevealedKey(response.privateKey);
      setKeyPassword('');
    } catch {
      setError('Failed to extract key. Incorrect password?');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount) return;
    
    setTxStatus('Constructing transaction...');
    setError('');
    setTxHash('');

    try {
      const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com', 11155111);
      const nonce = await provider.getTransactionCount(address);
      const feeData = await provider.getFeeData();
      
      const estimatedGas = await provider.estimateGas({
        to: recipient,
        value: parseEther(amount),
        from: address
      });
      
      const paddedGasLimit = (estimatedGas * 120n) / 100n;
      
      const unsignedTx = {
        to: recipient,
        value: parseEther(amount),
        from: address,
        chainId: 11155111,
        nonce,
        gasLimit: paddedGasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        type: 2
      };

      setTxStatus('Signing via Secure Enclave...');
      const vaultString = localStorage.getItem('wallet_vault');
      if (!vaultString) throw new Error('Vault missing.');

      const { signedTx } = await sendCommand<{ signedTx: string }>('SIGN_TRANSACTION', {
        encryptedVault: JSON.parse(vaultString),
        unsignedTx
        // Note: Password is no longer sent; the worker uses the active session cache.
      });

      setTxStatus('Broadcasting to Sepolia network...');
      const txResponse = await provider.broadcastTransaction(signedTx);
      
      setTxStatus('Transaction sent!');
      setTxHash(txResponse.hash);
      setRecipient('');
      setAmount('');
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Transaction failed: ${errorMessage}`);
      setTxStatus('');
    }
  };

  // --- Render Unlock Screen if not unlocked ---
  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 text-center">Unlock Wallet</h2>
          <form onSubmit={handleUnlock}>
            <input 
              type="password" 
              placeholder="Enter your password" 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 focus:outline-none focus:border-blue-500"
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <button type="submit" className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
              Unlock Secure Enclave
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Render Full Dashboard ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 relative">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <button onClick={handleLock} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm font-semibold transition-colors">
            Lock Wallet
          </button>
        </div>
        
        <div className="mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700 break-all">
          <p className="text-sm text-slate-400 mb-1">Public Address</p>
          <p className="font-mono text-slate-200">{address}</p>
        </div>

        <div className="mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700 text-center">
          <p className="text-sm text-slate-400 mb-1">Sepolia ETH Balance</p>
          {loading ? (
            <p className="text-xl font-bold text-slate-300 animate-pulse">Fetching...</p>
          ) : (
            <p className="text-3xl font-bold text-blue-400">{balance} ETH</p>
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-slate-700 pt-6 mb-6">
          <h3 className="text-lg font-bold mb-4">Send ETH</h3>
          <input 
            type="text" 
            placeholder="Recipient Address (0x...)" 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-3 font-mono text-sm focus:outline-none focus:border-blue-500"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            required
          />
          <input 
            type="number" 
            step="0.0001"
            placeholder="Amount (ETH)" 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 focus:outline-none focus:border-blue-500"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
          {error && <p className="text-red-400 text-sm mb-4 break-words">{error}</p>}
          {txStatus && <p className="text-blue-400 text-sm mb-4">{txStatus}</p>}
          {txHash && (
            <div className="mb-4 bg-green-900/30 border border-green-800 p-3 rounded text-sm">
              <p className="text-green-400 mb-1">Success! TX Hash:</p>
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-green-300 font-mono break-all hover:underline">
                {txHash}
              </a>
            </div>
          )}
          <button type="submit" disabled={!recipient || !amount || !!txStatus.includes('Constructing')} className="w-full px-6 py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
            Sign & Send Transaction
          </button>
        </form>
        
        <button onClick={() => setShowKeyModal(true)} className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors">
          Export Private Key
        </button>
      </div>

      {/* --- Private Key Modal --- */}
      {showKeyModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm z-50">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-red-400">View Private Key</h3>
            {!revealedKey ? (
              <form onSubmit={handleViewKey}>
                <p className="text-sm text-slate-300 mb-4">Enter your password to decrypt and view your raw private key. Never share this with anyone.</p>
                <input 
                  type="password" 
                  placeholder="Wallet Password" 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 focus:outline-none focus:border-red-500"
                  value={keyPassword}
                  onChange={e => setKeyPassword(e.target.value)}
                  required
                />
                <button type="submit" className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors mb-2">
                  Reveal Key
                </button>
                <button type="button" onClick={() => setShowKeyModal(false)} className="w-full px-4 py-2 text-slate-400 hover:text-slate-200">
                  Cancel
                </button>
              </form>
            ) : (
              <div>
                <p className="text-sm text-slate-300 mb-4">Your private key is displayed below. Anyone with this key controls your funds.</p>
                <div className="bg-slate-900 p-3 rounded border border-slate-700 mb-4 break-all">
                  <p className="font-mono text-red-400 text-sm select-all">{revealedKey}</p>
                </div>
                <button type="button" onClick={() => { setShowKeyModal(false); setRevealedKey(''); }} className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors">
                  Close & Secure
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-slate-50 font-sans">
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/create" element={<CreateWalletScreen />} />
          <Route path="/import" element={<ImportWalletScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
        </Routes>
      </div>
    </Router>
  );
}
