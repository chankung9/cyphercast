import React, { useState } from 'react';
import { useSolana } from '../context/SolanaProvider';


const StakePanel = ({ stream }) => {
const [amount, setAmount] = useState('');
const { provider } = useSolana();


const stake = async () => {
if (!provider) return alert('Connect wallet first');
console.log(`Stake ${amount} tokens into stream ${stream.title}`);
// TODO: integrate joinStream() RPC from client.ts
};


return (
<div>
<h4>Stake Tokens</h4>
<input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
<button onClick={stake}>Stake</button>
</div>
);
};


export default StakePanel;