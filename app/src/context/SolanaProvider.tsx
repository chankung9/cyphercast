import React, { createContext, useContext, useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { CypherCastClient, initializeClient } from '../../client';

interface SolanaContextType {
  connection: Connection;
  client: CypherCastClient | null;
  wallet: any;
  connected: boolean;
  connectWallet: () => Promise<void>;
  disconnect: () => void;
}

const SolanaContext = createContext<SolanaContextType | null>(null);

export const SolanaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<any>(null);
  const [client, setClient] = useState<CypherCastClient | null>(null);
  const [connected, setConnected] = useState(false);
  
  const connection = new Connection('http://localhost:8899', 'confirmed');

  const connectWallet = async () => {
    try {
      // In a real app, this would connect to Phantom/Solflare
      // For MVP demo, we'll use a mock wallet
      if (typeof window !== 'undefined' && (window as any).solana) {
        const { solana } = window as any;
        const response = await solana.connect();
        const mockWallet = {
          publicKey: response.publicKey,
          signTransaction: solana.signTransaction.bind(solana),
          signAllTransactions: solana.signAllTransactions.bind(solana),
        };
        setWallet(mockWallet);
        
        // Initialize client
        const newClient = await initializeClient(connection, mockWallet);
        setClient(newClient);
        setConnected(true);
      } else {
        // Fallback for development - use a test keypair
        const testWallet = {
          publicKey: new PublicKey('11111111111111111111111111111111'),
          signTransaction: async (tx: any) => tx,
          signAllTransactions: async (txs: any[]) => txs,
        };
        setWallet(testWallet);
        
        const newClient = await initializeClient(connection, testWallet);
        setClient(newClient);
        setConnected(true);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setClient(null);
    setConnected(false);
  };

  return (
    <SolanaContext.Provider value={{ 
      connection, 
      client, 
      wallet, 
      connected, 
      connectWallet, 
      disconnect 
    }}>
      {children}
    </SolanaContext.Provider>
  );
};

export const useSolana = () => {
  const context = useContext(SolanaContext);
  if (!context) {
    throw new Error('useSolana must be used within a SolanaProvider');
  }
  return context;
};