const ethers = require('ethers');
const bs58 = require('bs58');
const multihash = require('multihashes');


function abiEncodeWithSelector(functionName, abiTypes, abiValues) {
    const abiEncoder = new ethers.utils.AbiCoder()
    const initData = abiEncoder.encode(abiTypes, abiValues)
    const selector = createSelector(functionName, abiTypes)
    const encoded = selector + initData.slice(2)
    return encoded
}

function createSelector(functionName, abiTypes) {
    const joinedTypes = abiTypes.join(',')
    const functionSignature = `${functionName}(${joinedTypes})`

    const selector = ethers.utils.hexDataSlice(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(functionSignature)),
        0,
        4,
    )
    return selector
}

function hashToSha256 (hash) {
    return bs58
        .decode(hash)
        .toString("hex")
        .replace("1220", "0x")
}

function sha256ToHash(hex) {
    return hexToHash(`0x1220${hex.substr(2)}`)
}

function hexToHash (hex) {
    return bs58.encode(Buffer.from(hex.substr(2), "hex"))
}

function hashToHex (IPFSHash) {
   return "0x" + multihash.toHexString(multihash.fromB58String(IPFSHash))
}

async function findEventByName(contractAdress, abi, receipt, name, wallet) {
    let feedContract = new ethers.Contract(contractAdress, abi, wallet)
    let txRcpt = await wallet.provider.getTransactionReceipt(receipt)

    for (const key in txRcpt.logs) {
        let event = (txRcpt.logs[key]);

        if (feedContract.interface.parseLog(event) && feedContract.interface.parseLog(event).name == name) {
            let data = feedContract.interface.parseLog(event)
            return {
                name: data.name,
                values: data.values
            }
        }
    }
}


function hexlify (utf8str) {
    return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(utf8str))
}

module.exports = {
    abiEncodeWithSelector,
    hexlify,
    hashToSha256,
    sha256ToHash,
    hashToHex,
    findEventByName
}