#!/usr/bin/env node

/**
 * CypherCast Working CLI - Direct RPC approach
 * Bypasses Anchor SDK issues by using raw Solana Web3.js
 */

const { 
  Connection, 
  Keypair, 
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const borsh = require('borsh');

// Configuration
const PROGRAM_ID = new PublicKey('5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF');
const RPC_URL = 'http://localhost:8899';

// Instruction discriminators (from IDL)
const DISCRIMINATORS = {
  CREATE_STREAM: Buffer.from([71, 188, 111, 127, 108, 40, 229, 158]),
  JOIN_STREAM: Buffer.from([36, 104, 20, 203, 194, 246, 182, 204]),
  SUBMIT_PREDICTION: Buffer.from([193, 113, 41, 36, 160, 60, 247, 55]),
  END_STREAM: Buffer.from([191, 112, 170, 90, 86, 80, 202, 178]),
  CLAIM_REWARD: Buffer.from([149, 95, 181, 242, 94, 90, 158, 162]),
};

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class CypherCastDirectCLI {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.programId = PROGRAM_ID;
  }

  async initialize() {
    try {
      const walletPath = path.join(process.env.HOME, '.config/solana/id.json');
      this.keypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
      );
      
      log('✅ Initialized successfully', 'green');
      log(`   Wallet: ${this.keypair.publicKey.toString()}`, 'cyan');
      log(`   Program: ${this.programId.toString()}`, 'cyan');
      
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`, 'cyan');
      
      return true;
    } catch (error) {
      log(`❌ Initialization failed: ${error.message}`, 'red');
      return false;
    }
  }

  async deriveStreamPDA(creator, streamId) {
    const streamIdBuffer = Buffer.alloc(8);
    streamIdBuffer.writeBigUInt64LE(BigInt(streamId));
    
    return await PublicKey.findProgramAddress(
      [
        Buffer.from('stream'),
        creator.toBuffer(),
        streamIdBuffer
      ],
      this.programId
    );
  }

  async deriveParticipantPDA(stream, viewer) {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from('participant'),
        stream.toBuffer(),
        viewer.toBuffer()
      ],
      this.programId
    );
  }

  async derivePredictionPDA(stream, viewer) {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from('prediction'),
        stream.toBuffer(),
        viewer.toBuffer()
      ],
      this.programId
    );
  }

  serializeString(str) {
    const encoded = Buffer.from(str, 'utf-8');
    const length = Buffer.alloc(4);
    length.writeUInt32LE(encoded.length);
    return Buffer.concat([length, encoded]);
  }

  serializeU64(value) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
  }

  serializeI64(value) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64LE(BigInt(value));
    return buffer;
  }

  async createStream(title, description) {
    try {
      log('\n🎬 Creating Stream...', 'yellow');
      log('─'.repeat(50), 'cyan');
      
      const streamId = Date.now();
      const [streamPda, bump] = await this.deriveStreamPDA(this.keypair.publicKey, streamId);
      
      log(`Title: ${title}`, 'reset');
      log(`Description: ${description}`, 'reset');
      log(`Stream ID: ${streamId}`, 'cyan');
      log(`Stream PDA: ${streamPda.toString()}`, 'cyan');
      log(`Bump: ${bump}`, 'reset');
      
      // Check if already exists
      const existing = await this.connection.getAccountInfo(streamPda);
      if (existing) {
        log('\n⚠️  Stream already exists at this PDA', 'yellow');
        return { streamPda, streamId: streamId.toString() };
      }
      
      // Build instruction data: discriminator + stream_id (u64) + title (string) + start_time (i64)
      const startTime = Math.floor(Date.now() / 1000); // Unix timestamp
      const data = Buffer.concat([
        DISCRIMINATORS.CREATE_STREAM,
        this.serializeU64(streamId),
        this.serializeString(title),
        this.serializeI64(startTime),
      ]);
      
      // Build instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: streamPda, isSigner: false, isWritable: true },
          { pubkey: this.keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: this.programId,
        data,
      });
      
      // Send transaction
      const transaction = new Transaction().add(instruction);
      const signature = await this.connection.sendTransaction(
        transaction,
        [this.keypair],
        { skipPreflight: false }
      );
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      log(`\n✅ Stream created!`, 'green');
      log(`   Transaction: ${signature}`, 'cyan');
      log(`   Stream PDA: ${streamPda.toString()}`, 'cyan');
      log(`   Explorer: http://localhost:8899/tx/${signature}`, 'cyan');
      
      return { streamPda, streamId: streamId.toString(), signature };
      
    } catch (error) {
      log(`\n❌ Failed to create stream: ${error.message}`, 'red');
      if (error.logs) {
        log('Program logs:', 'yellow');
        error.logs.forEach(l => log(`   ${l}`, 'reset'));
      }
      throw error;
    }
  }

  async joinStream(streamPda, stakeAmount = 1000000) {
    try {
      log('\n👤 Joining Stream...', 'yellow');
      log('─'.repeat(50), 'cyan');
      
      const streamPubkey = new PublicKey(streamPda);
      const [participantPda, bump] = await this.deriveParticipantPDA(streamPubkey, this.keypair.publicKey);
      
      log(`Stream: ${streamPubkey.toString()}`, 'cyan');
      log(`Stake Amount: ${stakeAmount} lamports`, 'reset');
      log(`Participant PDA: ${participantPda.toString()}`, 'cyan');
      log(`Bump: ${bump}`, 'reset');
      
      // Build instruction data: discriminator + stake_amount (u64)
      const data = Buffer.concat([
        DISCRIMINATORS.JOIN_STREAM,
        this.serializeU64(stakeAmount),
      ]);
      
      // Build instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: streamPubkey, isSigner: false, isWritable: true },
          { pubkey: participantPda, isSigner: false, isWritable: true },
          { pubkey: this.keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: this.programId,
        data,
      });
      
      // Send transaction
      const transaction = new Transaction().add(instruction);
      const signature = await this.connection.sendTransaction(
        transaction,
        [this.keypair],
        { skipPreflight: false }
      );
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      log(`\n✅ Joined stream!`, 'green');
      log(`   Transaction: ${signature}`, 'cyan');
      log(`   Participant PDA: ${participantPda.toString()}`, 'cyan');
      
      return { participantPda, signature };
      
    } catch (error) {
      log(`\n❌ Failed to join stream: ${error.message}`, 'red');
      if (error.logs) {
        log('Program logs:', 'yellow');
        error.logs.forEach(l => log(`   ${l}`, 'reset'));
      }
      throw error;
    }
  }

  async submitPrediction(streamPda, choice, stake) {
    try {
      log('\n🎯 Submitting Prediction...', 'yellow');
      log('─'.repeat(50), 'cyan');
      
      const streamPubkey = new PublicKey(streamPda);
      const [predictionPda, bump] = await this.derivePredictionPDA(streamPubkey, this.keypair.publicKey);
      
      // Convert choice to u8 (0-255)
      const choiceU8 = typeof choice === 'string' ? parseInt(choice) || 0 : choice;
      
      log(`Stream: ${streamPubkey.toString()}`, 'cyan');
      log(`Choice: ${choiceU8}`, 'reset');
      log(`Stake: ${stake} lamports`, 'reset');
      log(`Prediction PDA: ${predictionPda.toString()}`, 'cyan');
      log(`Bump: ${bump}`, 'reset');
      
      // Build instruction data: discriminator + choice (u8) + stake_amount (u64)
      const data = Buffer.concat([
        DISCRIMINATORS.SUBMIT_PREDICTION,
        Buffer.from([choiceU8]),
        this.serializeU64(stake),
      ]);
      
      // Build instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: streamPubkey, isSigner: false, isWritable: true },
          { pubkey: predictionPda, isSigner: false, isWritable: true },
          { pubkey: this.keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: this.programId,
        data,
      });
      
      // Send transaction
      const transaction = new Transaction().add(instruction);
      const signature = await this.connection.sendTransaction(
        transaction,
        [this.keypair],
        { skipPreflight: false }
      );
      
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      log(`\n✅ Prediction submitted!`, 'green');
      log(`   Transaction: ${signature}`, 'cyan');
      log(`   Prediction PDA: ${predictionPda.toString()}`, 'cyan');
      
      return { predictionPda, signature };
      
    } catch (error) {
      log(`\n❌ Failed to submit prediction: ${error.message}`, 'red');
      if (error.logs) {
        log('Program logs:', 'yellow');
        error.logs.forEach(l => log(`   ${l}`, 'reset'));
      }
      throw error;
    }
  }

  async fetchAccount(pda, accountName = 'Account') {
    try {
      log(`\n📊 Fetching ${accountName}...`, 'yellow');
      log('─'.repeat(50), 'cyan');
      
      const pubkey = new PublicKey(pda);
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      
      if (!accountInfo) {
        log(`❌ ${accountName} not found`, 'red');
        return null;
      }
      
      log(`✅ ${accountName} found!`, 'green');
      log(`   Address: ${pubkey.toString()}`, 'cyan');
      log(`   Owner: ${accountInfo.owner.toString()}`, 'reset');
      log(`   Lamports: ${accountInfo.lamports}`, 'reset');
      log(`   Data length: ${accountInfo.data.length} bytes`, 'reset');
      log(`\nRaw Data (first 200 bytes):`, 'yellow');
      log(`   ${accountInfo.data.slice(0, 200).toString('hex')}`, 'reset');
      
      return accountInfo;
      
    } catch (error) {
      log(`\n❌ Failed to fetch account: ${error.message}`, 'red');
      throw error;
    }
  }

  async runFullDemo() {
    try {
      log('\n🎮 FULL DEMO - CypherCast Platform', 'bright');
      log('═'.repeat(50), 'cyan');
      
      // Step 1: Create stream
      const { streamPda } = await this.createStream(
        'Epic Gaming Stream',
        'Watch and earn with CypherCast!'
      );
      
      await this.sleep(2000);
      
      // Step 2: Join stream
      await this.joinStream(streamPda);
      
      await this.sleep(2000);
      
      // Step 3: Submit prediction (choice as u8: 0 = Team A, 1 = Team B, etc.)
      await this.submitPrediction(streamPda, 1, 1000000);
      
      await this.sleep(2000);
      
      // Step 4: Fetch stream data
      await this.fetchAccount(streamPda, 'Stream');
      
      log('\n═'.repeat(50), 'cyan');
      log('✅ DEMO COMPLETED SUCCESSFULLY!', 'green');
      log('═'.repeat(50) + '\n', 'cyan');
      
    } catch (error) {
      log('\n❌ Demo failed', 'red');
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const command = process.argv[2];
  const cli = new CypherCastDirectCLI();
  
  if (!(await cli.initialize())) {
    process.exit(1);
  }
  
  try {
    switch (command) {
      case 'create':
        const title = process.argv[3] || 'Test Stream';
        const description = process.argv[4] || 'A test stream on CypherCast';
        await cli.createStream(title, description);
        break;
        
      case 'join':
        if (!process.argv[3]) {
          log('❌ Please provide stream PDA', 'red');
          process.exit(1);
        }
        await cli.joinStream(process.argv[3]);
        break;
        
      case 'predict':
        if (!process.argv[3] || !process.argv[4]) {
          log('❌ Please provide stream PDA and choice', 'red');
          process.exit(1);
        }
        const stake = parseInt(process.argv[5] || '1000000');
        await cli.submitPrediction(process.argv[3], process.argv[4], stake);
        break;
        
      case 'fetch':
        if (!process.argv[3]) {
          log('❌ Please provide PDA', 'red');
          process.exit(1);
        }
        await cli.fetchAccount(process.argv[3], process.argv[4] || 'Account');
        break;
        
      case 'demo':
        await cli.runFullDemo();
        break;
        
      default:
        log('\n🎮 CypherCast Direct CLI', 'bright');
        log('═'.repeat(50), 'cyan');
        log('\nCommands:', 'yellow');
        log('  create [title] [description]     - Create stream', 'cyan');
        log('  join <pda>                       - Join stream', 'cyan');
        log('  predict <pda> <choice> [stake]   - Submit prediction', 'cyan');
        log('  fetch <pda> [name]               - Fetch account data', 'cyan');
        log('  demo                             - Run full demo', 'cyan');
        log('═'.repeat(50) + '\n', 'cyan');
        break;
    }
  } catch (error) {
    log(`\n❌ Command failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
