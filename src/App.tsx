// src/App.tsx
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useWalletWorker } from './hooks/useWalletWorker';
import type { EncryptedVault } from './types/worker';
import { JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { useEffect, useState } from 'react';

const WelcomeScreen = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-4xl font-bold mb-6">Secure Web3 Wallet</h1>
      <p className="text-slate-400 mb-8 max-w-md">
        A non-custodial, Web-Worker-isolated Ethereum wallet built for the Sepolia Testnet.
      </p>
      <div className="flex gap-4">
        <button onClick={() => navigate('/setup')} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
          Create New Wallet
        </button>
        <button onClick={() => navigate('/setup')} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors">
          Import Wallet
        </button>
      </div>
    </div>
  );
};

const SetupScreen = () => {
  const navigate = useNavigate();
  const { sendCommand } = useWalletWorker();
  
  const [view, setView] = useState<'select' | 'create' | 'import' | 'password'>('select');
  const [secret, setSecret] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { mnemonic } = await sendCommand<{ mnemonic: string }>('GENERATE_WALLET');
      setSecret(mnemonic);
      setView('create');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !secret) return;
    
    setLoading(true);
    try {
      const { encryptedVault, address } = await sendCommand<{ encryptedVault: EncryptedVault, address: string }>(
        'ENCRYPT_VAULT', 
        { secret, password }
      );
      
      // Store locally
      localStorage.setItem('wallet_vault', JSON.stringify(encryptedVault));
      localStorage.setItem('wallet_address', address);
      
      // Clear sensitive states from main thread immediately
      setSecret('');
      setPassword('');
      
      navigate('/dashboard');
    } catch (err) {
      console.error(err)
      setError('Failed to setup wallet. Check your secret formatting.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        {view === 'select' && (
          <>
            <h2 className="text-2xl font-bold mb-6 text-center">Setup Your Wallet</h2>
            <button onClick={handleGenerate} disabled={loading} className="w-full mb-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
              {loading ? 'Generating...' : 'Generate New Mnemonic'}
            </button>
            <button onClick={() => setView('import')} className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors">
              Import Existing Secret
            </button>
          </>
        )}

        {view === 'create' && (
          <>
            <h2 className="text-xl font-bold mb-4">Your Recovery Phrase</h2>
            <p className="text-sm text-red-400 mb-4 bg-red-400/10 p-3 rounded">
              Write this down offline. Never share it.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {secret.split(' ').map((word, i) => (
                <div key={i} className="bg-slate-900 p-2 text-center rounded text-sm text-slate-300 font-mono">
                  {word}
                </div>
              ))}
            </div>
            <button onClick={() => setView('password')} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
              I have saved it safely
            </button>
          </>
        )}

        {view === 'import' && (
          <>
            <h2 className="text-xl font-bold mb-4">Import Secret</h2>
            <p className="text-sm text-slate-400 mb-4">Paste your 12-word mnemonic or raw hex private key.</p>
            <textarea 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 h-32 focus:outline-none focus:border-blue-500 font-mono text-sm"
              placeholder="e.g. apple banana cherry..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <button onClick={() => setView('password')} disabled={!secret.trim()} className="w-full px-6 py-3 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 rounded-lg font-semibold transition-colors">
              Next Step
            </button>
          </>
        )}

        {view === 'password' && (
          <form onSubmit={handleFinalize}>
            <h2 className="text-xl font-bold mb-4">Secure Your Wallet</h2>
            <p className="text-sm text-slate-400 mb-4">Set a strong local password to encrypt your vault on this device.</p>
            <input 
              type="password" 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-6 focus:outline-none focus:border-blue-500"
              placeholder="Strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <button type="submit" disabled={loading || !password} className="w-full px-6 py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
              {loading ? 'Encrypting Vault...' : 'Encrypt & Save Wallet'}
            </button>
          </form>
        )}
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

  // Transaction State
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [txPassword, setTxPassword] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  useEffect(() => {
    if (!address) {
      navigate('/setup');
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount || !txPassword) return;
    
    setTxStatus('Constructing transaction...');
    setError('');
    setTxHash('');

    try {
      const provider = new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com', 11155111);
      
      // 1. Manually fetch the current nonce and fee data
      const nonce = await provider.getTransactionCount(address);
      const feeData = await provider.getFeeData();
      
      // Dynamically estimate the required gas based on the recipient
      const estimatedGas = await provider.estimateGas({
        to: recipient,
        value: parseEther(amount),
        from: address
      });
      
      // NEW: Apply a 20% safety buffer (unused gas is automatically refunded)
      const paddedGasLimit = (estimatedGas * 120n) / 100n;
      
      // 2. Construct the fully populated unsigned transaction
      const unsignedTx = {
        to: recipient,
        value: parseEther(amount),
        from: address,
        chainId: 11155111,
        nonce: nonce,
        gasLimit: paddedGasLimit, // Use the buffered limit
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        type: 2
      };

      setTxStatus('Sending to Secure Enclave for signing...');
      
      // 3. Retrieve the encrypted vault from localStorage
      const vaultString = localStorage.getItem('wallet_vault');
      if (!vaultString) throw new Error('Vault not found. Please re-import wallet.');
      const encryptedVault = JSON.parse(vaultString);

      // 4. Send payload to Web Worker
      const { signedTx } = await sendCommand<{ signedTx: string }>('SIGN_TRANSACTION', {
        encryptedVault,
        password: txPassword,
        unsignedTx
      });

      // Clear the password state immediately
      setTxPassword('');

      setTxStatus('Broadcasting to Sepolia network...');

      // 5. Broadcast the signed hex string
      const txResponse = await provider.broadcastTransaction(signedTx);
      
      setTxStatus('Transaction sent!');
      setTxHash(txResponse.hash);
      
      // Clear form
      setRecipient('');
      setAmount('');
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Transaction failed: ${errorMessage}`);
      setTxStatus('');
      setTxPassword('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-center">Dashboard</h2>
        
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

        <form onSubmit={handleSend} className="border-t border-slate-700 pt-6">
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
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-3 focus:outline-none focus:border-blue-500"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
          
          <input 
            type="password" 
            placeholder="Wallet Password to Sign" 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 mb-4 focus:outline-none focus:border-blue-500"
            value={txPassword}
            onChange={e => setTxPassword(e.target.value)}
            required
          />

          {error && <p className="text-red-400 text-sm mb-4 break-words">{error}</p>}
          {txStatus && <p className="text-blue-400 text-sm mb-4">{txStatus}</p>}
          {txHash && (
            <div className="mb-4 bg-green-900/30 border border-green-800 p-3 rounded text-sm">
              <p className="text-green-400 mb-1">Success! TX Hash:</p>
              <a 
                href={`https://sepolia.etherscan.io/tx/${txHash}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-green-300 font-mono break-all hover:underline"
              >
                {txHash}
              </a>
            </div>
          )}

          <button 
            type="submit" 
            disabled={!recipient || !amount || !txPassword || !!txStatus.includes('Constructing')}
            className="w-full px-6 py-3 bg-blue-600 disabled:opacity-50 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Sign & Send Transaction
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-slate-50 font-sans">
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/setup" element={<SetupScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
        </Routes>
      </div>
    </Router>
  );
}
