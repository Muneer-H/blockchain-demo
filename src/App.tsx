import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  Wallet,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Shield,
  Activity,
  Terminal,
  HelpCircle,
  Zap,
  Globe,
  History,
  Download
} from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI, TARGET_NETWORK, SEPOLIA_CHAIN_ID } from './contractConfig';
import './App.css';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface TxHistoryItem {
  id: string;
  message: string;
  hash: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  from: string;
  isSimulated?: boolean;
  isOnChainHistory?: boolean;
  blockNumber?: number;
}

export default function App() {
  // Web3 State
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(false);

  // Contract State
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<boolean>(false);
  const [lastFetchedTime, setLastFetchedTime] = useState<string | null>(null);
  
  // Form State
  const [newMessage, setNewMessage] = useState<string>('');
  const [txState, setTxState] = useState<'idle' | 'preparing' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  
  // History State
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'onchain' | 'session'>('all');

  // Utility Copy State
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const [copiedContract, setCopiedContract] = useState<boolean>(false);
  const [copiedTxHash, setCopiedTxHash] = useState<boolean>(false);

  const isSepolia = chainId === SEPOLIA_CHAIN_ID;

  // 1. Fetch Message from Contract
  const fetchMessage = useCallback(async () => {
    setLoadingMessage(true);
    try {
      if (isSandboxMode) {
        setTimeout(() => {
          if (!currentMessage) {
            setCurrentMessage("Hello Web3 World!");
          }
          setLastFetchedTime(new Date().toLocaleTimeString());
          setLoadingMessage(false);
        }, 400);
        return;
      }

      let provider: ethers.Provider;
      if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        provider = new ethers.JsonRpcProvider(TARGET_NETWORK.rpcUrl);
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const msg = await contract.message();
      setCurrentMessage(msg);
      setLastFetchedTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn("Error fetching contract message:", err);
      if (!currentMessage) {
        setCurrentMessage("Welcome to Blockchain Portal!");
      }
    } finally {
      setLoadingMessage(false);
    }
  }, [isSandboxMode, currentMessage]);

  // 2. Fetch Historical On-Chain Transactions for Sepolia Contract
  const fetchOnChainHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`https://eth-sepolia.blockscout.com/api/v2/addresses/${CONTRACT_ADDRESS}/transactions`);
      if (!res.ok) throw new Error("Failed to query Sepolia block explorer");
      
      const data = await res.json();
      const rawTxList = data.items || [];

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const fetchedItems: TxHistoryItem[] = [];

      for (const tx of rawTxList) {
        let msgValue = "";
        
        if (tx.decoded_input?.parameters?.[0]?.value) {
          msgValue = tx.decoded_input.parameters[0].value;
        } else if (tx.raw_input && tx.raw_input.startsWith("0x368b8772")) {
          try {
            const decoded = abiCoder.decode(["string"], "0x" + tx.raw_input.slice(10));
            msgValue = decoded[0];
          } catch {
            msgValue = "Updated message";
          }
        } else if (tx.transaction_types?.includes("contract_creation")) {
          msgValue = "[Contract Deployment / Initial Message]";
        } else {
          continue;
        }

        const dateStr = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "Unknown";

        fetchedItems.push({
          id: tx.hash,
          message: msgValue,
          hash: tx.hash,
          timestamp: dateStr,
          status: tx.result === 'success' || tx.status === 'ok' ? 'success' : 'failed',
          from: tx.from?.hash || 'Unknown',
          isOnChainHistory: true,
          blockNumber: tx.block_number
        });
      }

      setTxHistory(prev => {
        const existingHashes = new Set(prev.map(item => item.hash.toLowerCase()));
        const uniqueFetched = fetchedItems.filter(item => !existingHashes.has(item.hash.toLowerCase()));
        return [...prev, ...uniqueFetched];
      });
    } catch (err: any) {
      console.warn("Could not fetch full on-chain history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchOnChainHistory();
  }, [fetchOnChainHistory]);

  // 3. Connect Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setIsSandboxMode(true);
      fetchMessage();
      return;
    }

    try {
      setIsConnecting(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      
      if (accounts.length > 0) {
        const userAccount = accounts[0];
        setAccount(userAccount);
        setIsSandboxMode(false);

        const network = await provider.getNetwork();
        const hexChainId = `0x${network.chainId.toString(16)}`;
        setChainId(hexChainId);

        const rawBalance = await provider.getBalance(userAccount);
        const formattedBalance = parseFloat(ethers.formatEther(rawBalance)).toFixed(4);
        setBalance(formattedBalance);

        fetchMessage();
      }
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch Network to Sepolia
  const switchNetworkToSepolia = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // Chain 0xaa36a7 has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_CHAIN_ID,
              chainName: TARGET_NETWORK.name,
              rpcUrls: [TARGET_NETWORK.rpcUrl],
              nativeCurrency: { name: 'Sepolia ETH', symbol: 'SEP', decimals: 18 },
              blockExplorerUrls: [TARGET_NETWORK.explorer]
            }],
          });
        } catch (addError) {
          console.error("Error adding Sepolia chain:", addError);
        }
      }
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          connectWallet();
        } else {
          setAccount(null);
          setBalance(null);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    fetchMessage();
  }, [fetchMessage]);

  // 4. Write Message (`setMessage`)
  const handleSetMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setTxState('preparing');
    setTxError(null);
    setTxHash(null);

    // Sandbox / Demo Mode execution
    if (isSandboxMode || !account) {
      setTimeout(() => {
        setTxState('pending');
        const mockHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
        setTxHash(mockHash);

        setTimeout(() => {
          setTxState('success');
          setCurrentMessage(newMessage.trim());
          setLastFetchedTime(new Date().toLocaleTimeString());

          const newTx: TxHistoryItem = {
            id: Date.now().toString(),
            message: newMessage.trim(),
            hash: mockHash,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success',
            from: account || '0xSimulatedUser...99',
            isSimulated: true
          };
          setTxHistory(prev => [newTx, ...prev]);
          setNewMessage('');
        }, 1800);
      }, 1000);
      return;
    }

    // Real On-Chain Execution
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setTxState('pending');
      const tx = await contract.setMessage(newMessage.trim());
      setTxHash(tx.hash);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setTxState('success');
        setCurrentMessage(newMessage.trim());
        setLastFetchedTime(new Date().toLocaleTimeString());

        const newTx: TxHistoryItem = {
          id: tx.hash,
          message: newMessage.trim(),
          hash: tx.hash,
          timestamp: new Date().toLocaleTimeString(),
          status: 'success',
          from: account,
          blockNumber: receipt.blockNumber
        };
        setTxHistory(prev => [newTx, ...prev]);
        setNewMessage('');
      } else {
        setTxState('error');
        setTxError("Transaction failed on-chain execution.");
      }
    } catch (err: any) {
      console.error("SetMessage transaction error:", err);
      setTxState('error');
      
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
        setTxError("Transaction was cancelled by user.");
      } else if (err.message) {
        setTxError(err.message.slice(0, 120));
      } else {
        setTxError("An unexpected transaction error occurred.");
      }
    }
  };

  // Copy helper
  const copyText = (text: string, type: 'address' | 'contract' | 'tx') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else if (type === 'contract') {
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2000);
    } else {
      setCopiedTxHash(true);
      setTimeout(() => setCopiedTxHash(false), 2000);
    }
  };

  const shortAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const filteredHistory = txHistory.filter(item => {
    if (historyFilter === 'onchain') return item.isOnChainHistory;
    if (historyFilter === 'session') return !item.isOnChainHistory;
    return true;
  });

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header">
        <div>
          <div className="brand-badge">
            <Sparkles size={14} /> EVM DApp Demo
          </div>
          <h1 className="brand-title">
            Smart Contract <span className="glow">Message Portal</span>
          </h1>
        </div>

        <div className="header-actions">
          {/* Mode Switcher */}
          <div className="mode-switch" title="Toggle between real Web3 provider and interactive simulator">
            <button
              className={`mode-tab ${!isSandboxMode ? 'active' : ''}`}
              onClick={() => {
                if (window.ethereum) {
                  setIsSandboxMode(false);
                  connectWallet();
                } else {
                  alert("MetaMask browser extension is not installed. Staying in Simulated Sandbox mode.");
                }
              }}
            >
              <Globe size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Live Web3
            </button>
            <button
              className={`mode-tab ${isSandboxMode ? 'active' : ''}`}
              onClick={() => setIsSandboxMode(true)}
            >
              <Zap size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Sandbox
            </button>
          </div>

          {/* Wallet Badge / Button */}
          {account && !isSandboxMode ? (
            <div className="wallet-badge-connected">
              <span className="network-pill" style={{ background: isSepolia ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: isSepolia ? '#10b981' : '#f59e0b' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isSepolia ? '#10b981' : '#f59e0b', display: 'inline-block' }}></span>
                {isSepolia ? "Sepolia Testnet" : "Wrong Network"}
              </span>

              {!isSepolia && (
                <button
                  className="btn-secondary"
                  onClick={switchNetworkToSepolia}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#f59e0b', color: '#fcd34d' }}
                >
                  Switch to Sepolia
                </button>
              )}

              <span className="address-text" title={account}>{shortAddress(account)}</span>
              {balance && <span className="mono-pill" style={{ color: '#00f2fe' }}>{balance} {TARGET_NETWORK.symbol}</span>}
              <button 
                className="copy-btn" 
                onClick={() => copyText(account, 'address')} 
                title="Copy wallet address"
              >
                {copiedAddress ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
              </button>
            </div>
          ) : (
            <button className="btn-wallet" onClick={connectWallet} disabled={isConnecting}>
              <Wallet size={18} />
              {isConnecting ? "Connecting..." : isSandboxMode ? "Sandbox Connected" : "Connect Wallet"}
            </button>
          )}
        </div>
      </header>

      {/* Smart Contract Info Card */}
      <div className="glass-card" style={{ padding: '1.25rem 1.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Shield size={20} style={{ color: '#00f2fe' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Sepolia Smart Contract Address
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                <span className="mono-pill" style={{ fontSize: '0.85rem' }}>{CONTRACT_ADDRESS}</span>
                <button className="copy-btn" onClick={() => copyText(CONTRACT_ADDRESS, 'contract')} title="Copy Contract Address">
                  {copiedContract ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
              Methods: <span style={{ color: '#f8fafc', fontWeight: 600 }}>message()</span> [view] & <span style={{ color: '#f8fafc', fontWeight: 600 }}>setMessage(string)</span>
            </div>
            <a
              href={`${TARGET_NETWORK.explorer}/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              Sepolia Explorer <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: View State & Execute Transaction */}
      <div className="dashboard-grid">
        {/* Card 1: Read Current State */}
        <div className="glass-card">
          <div className="card-header">
            <h2 className="card-title">
              <Activity size={20} /> Current On-Chain State
            </h2>
            <button
              className="btn-secondary"
              onClick={fetchMessage}
              disabled={loadingMessage}
              title="Refresh contract message"
            >
              <RefreshCw size={14} className={loadingMessage ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="message-display-box">
            <div className="message-label">
              <Terminal size={14} /> Stored Message
            </div>
            
            {loadingMessage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8' }}>
                <RefreshCw size={18} className="animate-spin" /> Querying Sepolia blockchain...
              </div>
            ) : (
              <div className={`message-content ${!currentMessage ? 'empty' : ''}`}>
                "{currentMessage || "No message stored yet"}"
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Network: <strong style={{ color: '#10b981' }}>Sepolia Testnet</strong></span>
            {lastFetchedTime && <span>Updated at: {lastFetchedTime}</span>}
          </div>
        </div>

        {/* Card 2: Write Transaction (`setMessage`) */}
        <div className="glass-card">
          <div className="card-header">
            <h2 className="card-title">
              <Send size={20} /> Update Smart Contract
            </h2>
            {isSandboxMode && (
              <span className="badge-tag simulated">
                <Zap size={11} /> Sandbox Active
              </span>
            )}
          </div>

          <form onSubmit={handleSetMessage}>
            <div className="form-group">
              <label className="form-label" htmlFor="newMessageInput">
                New Message String
              </label>
              <div className="input-wrapper">
                <input
                  id="newMessageInput"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Hello, Sepolia Blockchain!"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  maxLength={280}
                  disabled={txState === 'preparing' || txState === 'pending'}
                  required
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                {newMessage.length} / 280 chars
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={!newMessage.trim() || txState === 'preparing' || txState === 'pending'}
            >
              {txState === 'preparing' || txState === 'pending' ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  {txState === 'preparing' ? "Confirm in Wallet..." : "Broadcasting Tx..."}
                </>
              ) : (
                <>
                  <Send size={18} /> Execute Transaction
                </>
              )}
            </button>
          </form>

          {/* Status Banners */}
          {txState === 'pending' && (
            <div className="status-banner pending">
              <RefreshCw size={18} className="animate-spin" style={{ flexShrink: 0 }} />
              <div>
                <strong>Transaction Pending</strong>
                <p style={{ margin: '0.2rem 0' }}>Submitted to block mempool. Waiting for confirmation...</p>
                {txHash && (
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="mono-pill">{txHash.substring(0, 18)}...</span>
                    <button className="copy-btn" onClick={() => copyText(txHash, 'tx')}>
                      {copiedTxHash ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {txState === 'success' && (
            <div className="status-banner success">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Transaction Confirmed!</strong>
                <p style={{ margin: '0.2rem 0' }}>State updated on-chain successfully.</p>
                {txHash && (
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="mono-pill">{txHash.substring(0, 16)}...</span>
                    <a
                      href={`${TARGET_NETWORK.explorer}/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      View on Etherscan <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {txState === 'error' && (
            <div className="status-banner error">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Transaction Failed</strong>
                <p style={{ margin: '0.2rem 0' }}>{txError}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contract On-Chain Transaction History */}
      <div className="glass-card">
        <div className="card-header" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="card-title">
              <History size={20} /> Sepolia Transaction History
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Historical transactions decoded directly from the Sepolia blockchain.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Filter Pills */}
            <div className="mode-switch">
              <button
                className={`mode-tab ${historyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('all')}
              >
                All ({txHistory.length})
              </button>
              <button
                className={`mode-tab ${historyFilter === 'onchain' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('onchain')}
              >
                On-Chain ({txHistory.filter(i => i.isOnChainHistory).length})
              </button>
              <button
                className={`mode-tab ${historyFilter === 'session' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('session')}
              >
                Session ({txHistory.filter(i => !i.isOnChainHistory).length})
              </button>
            </div>

            <button
              className="btn-secondary"
              onClick={fetchOnChainHistory}
              disabled={loadingHistory}
              title="Sync latest on-chain history"
            >
              <Download size={14} className={loadingHistory ? "animate-spin" : ""} />
              {loadingHistory ? "Syncing..." : "Sync History"}
            </button>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
            <HelpCircle size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
            <p>{loadingHistory ? "Loading transaction history from Sepolia..." : "No matching transactions found."}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tx-history-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Decoded Input / Message</th>
                  <th>Sender Address</th>
                  <th>Transaction Hash</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{item.timestamp}</td>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                      "{item.message}"
                    </td>
                    <td>
                      <span className="mono-pill" title={item.from}>
                        {shortAddress(item.from)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="mono-pill">{item.hash.substring(0, 14)}...</span>
                        {!item.isSimulated && (
                          <a
                            href={`${TARGET_NETWORK.explorer}/tx/${item.hash}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#94a3b8' }}
                            title="View transaction on Etherscan"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.isOnChainHistory ? (
                        <span className="badge-tag success">
                          <CheckCircle2 size={11} /> On-Chain
                        </span>
                      ) : item.isSimulated ? (
                        <span className="badge-tag simulated">
                          <Zap size={11} /> Sandbox
                        </span>
                      ) : (
                        <span className="badge-tag pending">
                          <Activity size={11} /> Live Session
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="app-footer">
        <div>Built for Web3 DApp Interactivity & Sepolia Smart Contract Execution</div>
        <div className="footer-links">
          <a href="https://docs.ethers.org" target="_blank" rel="noreferrer" className="footer-link">Ethers.js v6</a>
          <span>•</span>
          <a href="https://react.dev" target="_blank" rel="noreferrer" className="footer-link">React 19</a>
          <span>•</span>
          <a href="https://vite.dev" target="_blank" rel="noreferrer" className="footer-link">Vite</a>
        </div>
      </footer>
    </div>
  );
}
