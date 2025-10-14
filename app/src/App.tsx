import React, { useEffect, useState } from 'react';
import { useSolana } from './context/SolanaProvider';
import WalletConnect from './components/WalletConnect';
import StreamList from './components/StreamList';
import './App.css';

function App() {
  const { connected, client } = useSolana();
  const [streams, setStreams] = useState<any[]>([]);

  useEffect(() => {
    if (connected && client) {
      loadStreams();
    }
  }, [connected, client]);

  const loadStreams = async () => {
    // Mock streams for now - in production, fetch from program accounts
    const mockStreams = [
      { 
        id: 1, 
        creator: 'CreatorA', 
        title: 'Live Gaming Session', 
        viewers: 150,
        totalStake: 50,
        isActive: true
      },
      { 
        id: 2, 
        creator: 'CreatorB', 
        title: 'Music Performance', 
        viewers: 320,
        totalStake: 120,
        isActive: true
      },
    ];
    setStreams(mockStreams);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎮 CypherCast - Watch & Earn</h1>
        <WalletConnect />
      </header>

      <main className="App-main">
        {connected ? (
          <>
            <h2>Active Streams</h2>
            <StreamList streams={streams} onJoin={(id) => console.log('Join stream:', id)} />
          </>
        ) : (
          <div className="connect-prompt">
            <p>Connect your wallet to start watching and earning!</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
            >
              Join
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
