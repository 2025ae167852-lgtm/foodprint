// routes/blockchain.js
var express = require('express');
var router = express.Router();
var algosdk = null;
try {
  algosdk = require('algosdk');
} catch (e) {
  // algosdk not installed — we'll still run but blockchain endpoints will be disabled
  algosdk = null;
}
var moment = require('moment'); //datetime
var crypto = require('crypto');
var initModels = require('../models/init-models');
var sequelise = require('../config/db/db_sequelise');

var models = initModels(sequelise);

// Read environment variables
var account1_mnemonic = process.env.ACCOUNT1_MNEMONIC;
var account2_mnemonic = process.env.ACCOUNT2_MNEMONIC;
var BLOCKCHAINENV = process.env.BLOCKCHAINENV;

// If required variables are present, set up Algod client; otherwise mark disabled.
let blockchainEnabled = true;
if (!algosdk || !account1_mnemonic || !account2_mnemonic || !BLOCKCHAINENV) {
  console.warn('⚠ Blockchain disabled: missing algosdk or required environment variables (ACCOUNT1_MNEMONIC/ACCOUNT2_MNEMONIC/BLOCKCHAINENV).');
  blockchainEnabled = false;
}

let recoveredAccount1 = null;
let recoveredAccount2 = null;
let algodclient = null;

if (blockchainEnabled) {
  try {
    recoveredAccount1 = algosdk.mnemonicToSecretKey(account1_mnemonic);
    recoveredAccount2 = algosdk.mnemonicToSecretKey(account2_mnemonic);
  } catch (e) {
    console.error('Error recovering accounts from mnemonics:', e.message || e);
    blockchainEnabled = false;
  }
}

// If enabled, set up algod client
if (blockchainEnabled) {
  const environment = process.env.BLOCKCHAINENV || 'DEV';
  let token, server, port;
  if (environment === 'TESTNET') {
    token = { 'X-API-Key': process.env.TESTNET_ALGOD_API_KEY || process.env.TESTNET_ALGOD_TOKEN };
    server = process.env.TESTNET_ALGOD_SERVER;
    port = process.env.TESTNET_ALGOD_PORT || 443;
  } else if (environment === 'MAINNET') {
    token = { 'X-API-Key': process.env.MAINNET_ALGOD_API_KEY };
    server = process.env.MAINNET_ALGOD_SERVER;
    port = process.env.MAINNET_ALGOD_PORT || 443;
  } else {
    token = process.env.DEV_ALGOD_API_KEY || '';
    server = process.env.DEV_ALGOD_SERVER || 'http://localhost';
    port = process.env.DEV_ALGOD_PORT || 4001;
  }

  try {
    algodclient = new algosdk.Algodv2(token, server, port);
    console.log('✅ Algod client configured:', server);
  } catch (e) {
    console.error('Unable to create Algod client:', e.message || e);
    blockchainEnabled = false;
  }
}

// Wait for confirmation helper (only used if blockchainEnabled)
const waitForConfirmation = async function (algodClient, txId, timeout) {
  if (!blockchainEnabled) throw new Error('Blockchain is disabled');
  if (algodClient == null || txId == null || timeout < 0) throw new Error('Bad arguments');
  const status = await algodClient.status().do();
  const startround = status['last-round'] + 1;
  let currentround = startround;
  while (currentround < startround + timeout) {
    const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
    if (pendingInfo !== undefined) {
      if (pendingInfo['confirmed-round'] !== null && pendingInfo['confirmed-round'] > 0) {
        return pendingInfo;
      } else {
        if (pendingInfo['pool-error'] != null && pendingInfo['pool-error'].length > 0) {
          throw new Error('Transaction ' + txId + ' rejected - pool error: ' + pendingInfo['pool-error']);
        }
      }
    }
    await algodClient.statusAfterBlock(currentround).do();
    currentround++;
  }
  throw new Error('Transaction ' + txId + ' not confirmed after ' + timeout + ' rounds!');
};

// Health / status endpoint
router.get('/app/test/blockchain/algod', async function (req, res) {
  if (!blockchainEnabled) {
    return res.status(503).json({ ok: false, message: 'Blockchain disabled on this deployment' });
  }
  try {
    let status = await algodclient.status().do();
    res.json({ ok: true, status });
  } catch (e) {
    console.error('Algod status error:', e);
    res.status(500).json({ ok: false, error: e.message || e });
  }
});

// Example: add harvest to blockchain (safe stub when disabled)
router.post('/app/harvest/save/blockchain', async function (req, res) {
  if (!blockchainEnabled) {
    return res.status(501).json({
      success: false,
      message: 'Blockchain functionality is disabled in this deployment',
    });
  }

  try {
    let params = await algodclient.getTransactionParams().do();
    let supplyChainData = JSON.stringify(req.body || {});
    const enc = new TextEncoder();
    const note = enc.encode(supplyChainData);
    let txn = {
      from: recoveredAccount1.addr,
      to: recoveredAccount2.addr,
      fee: 1000,
      amount: 0,
      firstRound: params.firstRound,
      lastRound: params.lastRound,
      genesisID: params.genesisID,
      genesisHash: params.genesisHash,
      note: note,
    };

    let signedTxn = algosdk.signTransaction(txn, recoveredAccount1.sk);
    let sendTx = await algodclient.sendRawTransaction(signedTxn.blob).do();
    let confirmedTxn = await waitForConfirmation(algodclient, sendTx.txId, 4);

    // Update DB (best-effort, won't throw)
    try {
      const txnNote = new TextDecoder().decode(confirmedTxn.txn.txn.note);
      const transactionId = sendTx.txId;
      // small helper; keep it minimal to avoid heavy DB coupling here
      const supplyChainDataHash = crypto.createHash('sha256').update(supplyChainData).digest('base64');
      await models.FoodprintHarvest.update(
        {
          harvest_BlockchainHashID: supplyChainDataHash,
          harvest_BlockchainHashData: supplyChainData,
          harvest_bool_added_to_blockchain: true,
          harvest_added_to_blockchain_date: moment().format('YYYY-MM-DD HH:mm:ss'),
          harvest_blockchain_uuid: transactionId,
        },
        { where: { harvest_logid: req.body.logID } }
      ).catch(err => console.warn('DB update warning:', err.message || err));
    } catch (e) {
      console.warn('Warning during DB update after blockchain tx:', e.message || e);
    }

    res.status(201).json({
      success: true,
      message: 'Harvest entry added to Algorand blockchain',
      harvestLogid: req.body.logID,
      transactionId: sendTx.txId,
    });
  } catch (e) {
    console.error('Blockchain error:', e);
    res.status(500).json({ success: false, message: e.message || e });
  }
});

// Storage route (similar stub/implementation)
router.post('/app/storage/save/blockchain', async function (req, res) {
  if (!blockchainEnabled) {
    return res.status(501).json({
      success: false,
      message: 'Blockchain functionality is disabled in this deployment',
    });
  }

  try {
    let params = await algodclient.getTransactionParams().do();
    let supplyChainData = JSON.stringify(req.body || {});
    const enc = new TextEncoder();
    const note = enc.encode(supplyChainData);
    let txn = {
      from: recoveredAccount1.addr,
      to: recoveredAccount2.addr,
      fee: 1000,
      amount: 0,
      firstRound: params.firstRound,
      lastRound: params.lastRound,
      genesisID: params.genesisID,
      genesisHash: params.genesisHash,
      note: note,
    };

    let signedTxn = algosdk.signTransaction(txn, recoveredAccount1.sk);
    let sendTx = await algodclient.sendRawTransaction(signedTxn.blob).do();
    let confirmedTxn = await waitForConfirmation(algodclient, sendTx.txId, 4);

    // best-effort DB update
    try {
      const supplyChainDataHash = crypto.createHash('sha256').update(supplyChainData).digest('base64');
      await models.FoodprintStorage.update(
        {
          storage_BlockchainHashID: supplyChainDataHash,
          storage_BlockchainHashData: supplyChainData,
          storage_bool_added_to_blockchain: true,
          storage_added_to_blockchain_date: moment().format('YYYY-MM-DD HH:mm:ss'),
          storage_blockchain_uuid: sendTx.txId,
        },
        { where: { storage_logid: req.body.logID } }
      ).catch(err => console.warn('DB update warning:', err.message || err));
    } catch (e) {
      console.warn('Warning during DB update after blockchain tx:', e.message || e);
    }

    res.status(201).json({
      success: true,
      message: 'Storage entry added to Algorand blockchain',
      storageLogid: req.body.logID,
      transactionId: sendTx.txId,
    });
  } catch (e) {
    console.error('Blockchain error:', e);
    res.status(500).json({ success: false, message: e.message || e });
  }
});

module.exports = router;
