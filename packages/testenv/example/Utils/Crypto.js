const ethers = require('ethers');
const util = require('util')
const crypto = require('crypto');
const cryptoIpfs = require('@erasure/crypto-ipfs');
const utils = require('./utils')
const IPFS = require('./IPFS')
const textEncoder = new util.TextEncoder()
const textDecoder = new util.TextDecoder()
let db = require('../dbInfo');

async function genKeyPair(wallet) {
    try {
        
        const address = wallet.address;
        const msg = `I am signing this message to generate my ErasureClient keypair as ${address}`;
        const signature = await wallet.signMessage(msg)
        const salt = crypto.createHash('sha256').update(address).digest('base64')
        const key = cryptoIpfs.crypto.asymmetric.generateKeyPair(
            signature,
            salt
        );

        return {
            msg,
            signature,
            key,
            salt
        };
    } catch (error) {
        throw error
    }
}

  /**
   * Submit new data to this feed
   * - can only called by feed owner
   *
   * @method genProofHash
   * @param {string} data - raw data to be posted
   * @param {string} creator - the one who deploys the contract or has posted the feed 
   */

async function genProofHash(data, creator) {
    db.symKey = cryptoIpfs.crypto.symmetric.generateKey();
    console.log(`Using SymKey: ${db.symKey}`);
    
    const encryptedData = await cryptoIpfs.crypto.symmetric.encryptMessage(db.symKey, data);
    const keyhash = await IPFS.getHash(db.symKey);
    const datahash = await IPFS.getHash(data)
    const encryptedDatahash = await IPFS.add(encryptedData) 

    const staticMetadataB58 = await IPFS.add(
        JSON.stringify({
            creator: creator.address,
            datahash,
            keyhash,
            encryptedDatahash
        })
    );
   
    const proofhash = utils.hashToSha256(staticMetadataB58); 
    const metadata = utils.hashToHex(staticMetadataB58) 

    return {
        proofhash,
        metadata
    }

}

async function encrypt(PubKey, symkey, walletToLock) {
    let msg = textEncoder.encode(symkey) 

    let pubKeyToUint8 = Uint8Array.from(Buffer.from(PubKey.slice(2), 'hex'));
    let SellerKeyPair = await genKeyPair(walletToLock)

    let randomNonce = cryptoIpfs.crypto.asymmetric.generateNonce(); 
    let encryptedSymKey_Buyer = cryptoIpfs.crypto.asymmetric.encryptMessage(msg, randomNonce, pubKeyToUint8, SellerKeyPair.key.secretKey)

    return {
        encryptedSymKey_Buyer,
        randomNonce
    }
}

async function decrypt(encryptedKey, lockedPubKey, randomNonce, walletToUnlock) {
    
    let BuyerKeypair = await genKeyPair(walletToUnlock)
    let pubKeyToUint8 = Uint8Array.from(Buffer.from(lockedPubKey.slice(2), 'hex'));
    

    let decrypted_Buyer = await cryptoIpfs.crypto.asymmetric.decryptMessage(encryptedKey, randomNonce, pubKeyToUint8, BuyerKeypair.key.secretKey)
    
    let stringToArray = decrypted_Buyer.split(',').map(Number)
    let uintArr = new Uint8Array(stringToArray)
    let decryptedKey = textDecoder.decode(uintArr)

    return decryptedKey
}

async function validateData(soldDataB58, buyer, sellerPubKey, postProofHash) {
    // Decrypt Sold Data
    const staticMetadataB58Sold = utils.sha256ToHash(soldDataB58);
    const IpfsData = JSON.parse(await IPFS.get(staticMetadataB58Sold))
    
    const encryptedSymKey_Buyer = new Uint8Array(Object.values(IpfsData.encryptedInfo.encryptedSymKey_Buyer))
    const randomNonce = new Uint8Array(Object.values(IpfsData.encryptedInfo.randomNonce))
    const soldProofhash = utils.sha256ToHash(IpfsData.proofhash)

    let decryptedSymKey = await decrypt(encryptedSymKey_Buyer, sellerPubKey, randomNonce, buyer)
    
    const decryptedSoldData = JSON.parse(await IPFS.get(soldProofhash))
    console.log();
    console.log('==================');
    console.log('decrypted Sold Data');
    console.log(decryptedSoldData);
    console.log('==================');
    
    

    //Decrypt original Data
    const postedFeedData = utils.sha256ToHash(postProofHash)
    const postedIpfsObject = JSON.parse(await IPFS.get(postedFeedData))

    console.log();
    console.log('==================');
    console.log('Data from Posted Object');
    console.log(postedIpfsObject);
    console.log('==================');
    
    //decrypt Data from original post
    const data = await IPFS.get(postedIpfsObject.encryptedDatahash)
    console.log();
    console.log('==================');
    console.log('Encrypted Data from original post');
    console.log(data);
    console.log('==================');
    
    

    //data revealed
    const rawdata = cryptoIpfs.crypto.symmetric.decryptMessage(decryptedSymKey, data)
    console.log();
    console.log('==================');
    console.log('Raw Data revealed');
    console.log(rawdata);
    console.log('==================');
    
    //validate SymKey && keyHash
    const keyhashFromEscrow = await IPFS.getHash(decryptedSymKey);
    const datahashFromEscrow = await IPFS.getHash(rawdata)

    console.log();
    console.log('==================');
    console.log('status');
    console.log((keyhashFromEscrow === decryptedSoldData.keyhash && datahashFromEscrow === decryptedSoldData.datahash));
    console.log('==================');

    return {
        rawdata,
        status: keyhashFromEscrow === decryptedSoldData.keyhash && datahashFromEscrow === decryptedSoldData.datahash
    }
    
}

module.exports = {
    encrypt,
    decrypt,
    genKeyPair,
    genProofHash,
    validateData
}