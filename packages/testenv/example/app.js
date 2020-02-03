const fs = require('fs')
const ethers = require('ethers');
const { findEventByName } = require('./Utils/utils')
const Crypto = require('./Utils/Crypto')
const provider = new ethers.providers.JsonRpcProvider()
const erasureUsersABI = require('../build/Erasure_Users.json');
const escrowABI = require('../build/CountdownGriefingEscrow.json')
const AgreementFactory_Artifact = require('../build/CountdownGriefing.json')

const privateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
let wallet = new ethers.Wallet(privateKey, provider);
let users_contract = new ethers.Contract('0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab', erasureUsersABI.compilerOutput.abi, wallet);
let users = require('./users.json');
let walletSeller, walletBuyer, walletRequester, walletFulfiller;
let db = require('./dbInfo'); //to be changed to js
let Escrow = require('./Utils/escrowjs');
let Feed = require('./Utils/feedjs');

(async () => {
    await fundWallets()

    await registerUser(walletSeller);
    await registerUser(walletBuyer);
    console.log('success');
    
    let { proofhash, metadata} = await Crypto.genProofHash('my secret prediction is worthy ', walletSeller)
    
    await Feed.createFeedContract(walletSeller, proofhash, metadata); 
    
    let escrowContract = await Escrow.createEscrow(wallet, walletSeller, walletBuyer);
    
    db.EscrowContractAddress = escrowContract.address
    

    await Escrow.mintAndApproveTokens('2', walletSeller, db.EscrowContractAddress) 
    await Escrow.mintAndApproveTokens('2', walletBuyer, db.EscrowContractAddress) 
    await Escrow.depositStake(db.EscrowContractAddress, walletSeller)
    await Escrow.depositPayment(db.EscrowContractAddress, walletBuyer)


    let escrowSeller = new ethers.Contract(db.EscrowContractAddress, escrowABI.compilerOutput.abi, walletSeller);
    let tx = await escrowSeller.finalize(); //0x325DB14Ef11C22A7f209839712689bec96FC6d00
    db.agreementAddress = (await findEventByName(db.EscrowContractAddress, escrowABI.compilerOutput.abi, tx.hash, 'Finalized', wallet)).values.agreement //escrowContract.address, tx.hash
    let agreementContract = new ethers.Contract(db.agreementAddress, AgreementFactory_Artifact.compilerOutput.abi, wallet)

    // generate Sell Data from Seller
    let sellData = await Feed.generateSellData(walletBuyer, db.feedTxHash, db.feedContractAddress, users_contract, walletSeller)
    
    let submitSaleDataTx = await escrowSeller.submitData(sellData) 
    
    db.escrowSubmitTx = { 
        hash: submitSaleDataTx.hash,
        revealed: false
    }
     
    // validate Sell Data by Buyer
    let soldDataB58 = (await findEventByName(escrowContract.address, escrowABI.compilerOutput.abi, db.escrowSubmitTx.hash, 'DataSubmitted', walletBuyer)).values.data
    
    let sellerPubKeyAsym = await users_contract.getUserData(walletSeller.address)
    let originalProofHash = (await Feed.getSellDataFromTx(db.feedContractAddress, db.feedTxHash, 'Initialized', walletBuyer)).proofHash

    let result = await Crypto.validateData(soldDataB58, walletBuyer, sellerPubKeyAsym, originalProofHash);
    console.log(result);
    
    if (result.status) {
        db.escrowSubmitTx.revealed = result.status
        db.escrowSubmitTx.revealedRawData = result.rawdata;
    }
   
    await fs.writeFileSync('./dbInfo.json', JSON.stringify(db))
})()
   
async function registerUser(_wallet) {
    let users_contract = new ethers.Contract('0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab', erasureUsersABI.compilerOutput.abi, _wallet);


    let keyPair = await Crypto.genKeyPair(_wallet)
    const publicKey = Buffer.from(keyPair.key.publicKey).toString("hex");

  

    const tx = await users_contract.registerUser(`0x${publicKey}`)
    await tx.wait()
    let data = await users_contract.getUserData(_wallet.address);
    console.log('user data -> ', data);
}




async function fundWallets() {
    
    const fundAmount = ethers.utils.parseEther('5');
    
    // wallets and addresses
    const seller = users.User1.address;
    const buyer = users.User2.address;
    const requester = users.User3.address;
    const fulfiller = users.User4.address;


    

    walletSeller = new ethers.Wallet(users.User1.privateKey, provider);
    walletBuyer = new ethers.Wallet(users.User2.privateKey, provider);
    walletRequester = new ethers.Wallet(users.User3.privateKey, provider);
    walletFulfiller = new ethers.Wallet(users.User4.privateKey, provider);

    


    
    let transactionSeller = {
        to: seller,
        value: fundAmount,
    };

    let transactionBuyer = {
        to: buyer,
        value: fundAmount,
    };

    let transactionRequestor = {
        to: requester,
        value: fundAmount,
    };

    let transactionFulfiller = {
        to: fulfiller,
        value: fundAmount,
    };

    await wallet.sendTransaction(transactionSeller);
    await wallet.sendTransaction(transactionBuyer);
    await wallet.sendTransaction(transactionRequestor);
    await wallet.sendTransaction(transactionFulfiller);

    // let test = await provider.getBalance(seller);
    // let test2 = await provider.getBalance(buyer);
    // let test3 = await provider.getBalance(requester);
    // let test4 = await provider.getBalance(fulfiller);

    

    // return { walletSeller, walletBuyer, walletRequester, walletFulfiller}
}