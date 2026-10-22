// src/App.tsx
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// --- Placeholder Components (To be expanded in Phase 4 & 5) ---

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
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-2xl font-bold mb-4">Wallet Setup</h2>
      <p className="text-slate-400">Worker integration & KDF will be implemented here.</p>
    </div>
  );
};

const DashboardScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <p className="text-slate-400">Balances and Send ETH forms will live here.</p>
    </div>
  );
};

// --- Main App Component ---

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