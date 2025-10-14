import React from 'react';

interface Stream {
  id: number;
  creator: string;
  title: string;
  viewers: number;
  totalStake: number;
  isActive: boolean;
}

interface StreamListProps {
  streams: Stream[];
  onJoin: (streamId: number) => void;
}

const StreamList: React.FC<StreamListProps> = ({ streams, onJoin }) => {
  return (
    <div className="stream-list">
      {streams.map((stream) => (
        <div key={stream.id} className="stream-card">
          <h3>{stream.title}</h3>
          <p>Creator: {stream.creator}</p>
          <p>👥 {stream.viewers} viewers</p>
          <p>💰 {stream.totalStake} SOL staked</p>
          <p>{stream.isActive ? '🟢 Live' : '⚫ Ended'}</p>
          <button 
            onClick={() => onJoin(stream.id)}
            disabled={!stream.isActive}
          >
            {stream.isActive ? 'Join Stream' : 'Stream Ended'}
          </button>
        </div>
      ))}
      {streams.length === 0 && (
        <p>No active streams at the moment. Check back soon!</p>
      )}
    </div>
  );
};

export default StreamList;