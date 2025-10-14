import React from 'react';
import { useSolana } from '../context/SolanaProvider';


const WalletConnect = () => {
const { wallet, connectWallet } = useSolana();


return (
<div>
{wallet ? (
<div>Wallet: {wallet.publicKey.toBase58()}</div>
) : (
<button onClick={connectWallet}>Connect Wallet</button>
)}
</div>
);
};


export default WalletConnect;