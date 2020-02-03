
const Ipfs = require('ipfs-http-client');
const ipfsConfig = require('./config.json');
const cryptoIpfs = require('@erasure/crypto-ipfs');
const Hash = require('ipfs-only-hash')

async function onlyHash (data) {
    let buf = data

    if (!Buffer.isBuffer(data)) {
        buf = Buffer.from(data)
    }
    const hash = await Hash.of(buf)
    return hash
}


const IPFS = {
    ipfs: null,
    keystore: {},
    getClient: () => {
        if (IPFS.ipfs === null) {
            IPFS.ipfs = new Ipfs(ipfsConfig.ipfs.host, ipfsConfig.ipfs.port, {
                protocol: ipfsConfig.ipfs.protocol
            });
        }

        return IPFS.ipfs;
    },
    getHash: async data => {
        try {
            
            let test = await onlyHash(data);
            return test
        } catch (err) {
            throw err;
        }
    },
    add: async (data, retry = true) => {
        try {
            let client = await IPFS.getClient()
            let result = await client.add(data)
            
            return result[0].path
            
        } catch (err) {
            if (retry) {
                return await IPFS.add(data, false);
            } else {
                throw err;
            }
        }
    },
    get: async (hash, retry = true) => {
        try {

            let client = await IPFS.getClient();
            let result = await client.get(hash)
            return Buffer.from(result[0].content).toString()



            // return IPFS.keystore[hash];
            // const results = await IPFS.getClient().get(hash);
            // return results[0].content.toString();
        } catch (err) {
            if (retry) {
                return await IPFS.get(hash, false);
            } else {
                throw err;
            }
        }
    }
    
}


module.exports = IPFS;