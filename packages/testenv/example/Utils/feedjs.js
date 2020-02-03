let feedABI = require('../../build/Feed.json');
let feedFactoryABI = require('../../build/Feed_Factory.json');
const ethers = require('ethers');
let utils = require('./utils');
const Crypto = require('./Crypto');
const IPFS = require('./IPFS');
const db = require('../dbInfo');


async function generateSellData(buyer, submitTx, contractAddress, users_contract, walletSeller) {
    
    let proofhash = (await utils.findEventByName(contractAddress, feedABI.compilerOutput.abi, submitTx, 'Initialized', buyer)).values.proofHash
    let buyerAsymPubkey = await users_contract.getUserData(buyer.address)

    let encryptedInfo = await Crypto.encrypt(buyerAsymPubkey, db.symKey, walletSeller)

    let json_sellData_120 = JSON.stringify({
        encryptedInfo,
        proofhash
    })

    const sellDataToIPFS = await IPFS.add(
        json_sellData_120
    ); 

    return utils.hashToSha256(sellDataToIPFS)
}

async function getSellDataFromTx(feedContractAddress, tx, name, wallet) {
    return (await utils.findEventByName(feedContractAddress, feedABI.compilerOutput.abi, tx, name, wallet)).values
}

async function createFeedContract(_wallet, proofhash, metadata) {

    let feedFactory = new ethers.Contract('0x67B5656d60a809915323Bf2C40A8bEF15A152e3e', feedFactoryABI.compilerOutput.abi, _wallet)
    let operator = _wallet.address;

    let args = [operator, proofhash, metadata]
    let callData = utils.abiEncodeWithSelector(
        'initialize',
        ['address', 'bytes32', 'bytes'],
        args,
    )

    let tx = await feedFactory.create(callData);
    let txRcpt = await tx.wait();

    const expectedEvent = 'InstanceCreated'
    const createFeedEvent = txRcpt.events.find(
        emittedEvent => emittedEvent.event === expectedEvent,
        'There is no such event',
    )
    const feedAddress = createFeedEvent.args.instance;
    db.feedTxHash = txRcpt.transactionHash
    db.feedContractAddress = feedAddress
}

module.exports = {
    generateSellData,
    getSellDataFromTx,
    createFeedContract
}