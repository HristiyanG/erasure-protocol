const ethers = require('ethers')
const { abiEncodeWithSelector } = require('./utils')
let CountdownGriefingEscrow_FactoryABI = require('../../build/CountdownGriefingEscrow_Factory.json')
let Erasure_EscrowsABI = require('../../build/Erasure_Escrows.json');

let AgreementFactory_Artifact = require('../../build/CountdownGriefing_Factory.json')
let AgreementRegistry_Artifact = require('../../build/Erasure_Agreements.json')
const CountdownGriefingEscrowABI = require('../../build/CountdownGriefingEscrow.json');

const escrowABI = require('../../build/CountdownGriefingEscrow.json')
const mockNMRABI = require('../../build/MockNMR.json')



async function createEscrow(wallet, seller, buyer) {

    const escrowCountdown = 2 * 24 * 60 * 60 // 2 days
    const agreementCountdown = 30 * 24 * 60 * 60 // 30 days
    const paymentAmount = ethers.utils.parseEther('2')
    const stakeAmount = ethers.utils.parseEther('1')
    const griefRatio = ethers.utils.parseEther('3')
    const ratioType = 2
    const encryptedSymKey = '0x12341234123412341234'

   
    let factory = new ethers.Contract('0x26b4AFb60d6C903165150C6F0AA14F8016bE4aec', CountdownGriefingEscrow_FactoryABI.compilerOutput.abi, wallet)
    let registry = new ethers.Contract('0x254dffcd3277C0b1660F6d42EFbB754edaBAbC2B', Erasure_EscrowsABI.compilerOutput.abi, wallet);

    let agreementFactory = new ethers.Contract('0x59d3631c86BbE35EF041872d502F218A39FBa150', AgreementFactory_Artifact.compilerOutput.abi, wallet)
    let agreementRegistry = new ethers.Contract('0xCfEB869F69431e42cdB54A4F4f105C19C080A601', AgreementRegistry_Artifact.compilerOutput.abi, wallet);

    const AbiCoder = new ethers.utils.AbiCoder();

    // register factories in registries
    // const abiCodedAddress = AbiCoder.encode(
    //     ['address'],
    //     [agreementFactory.address],
    // )

    // await registry.addFactory(factory.address, abiCodedAddress) // this is not goind to pass if we used the test env from the erasure-protocol as this factory has already been registered
    // await agreementRegistry.addFactory(agreementFactory.address, '0x') // same
    

    const agreementTypes = ['uint120', 'uint8', 'uint128']
    const agreementParams = [griefRatio, ratioType, agreementCountdown]
    const encodedParams = AbiCoder.encode(agreementTypes, agreementParams)

    let initTypes = [
        'address',
        'address',
        'address',
        'uint256',
        'uint256',
        'uint256',
        'bytes',
        'bytes',
    ]

    let initParams = [
        wallet.address, //operator
        buyer.address,
        seller.address,
        paymentAmount,
        stakeAmount,
        escrowCountdown,
        '0x',
        encodedParams,
    ]
    const calldata = abiEncodeWithSelector('initialize', initTypes, initParams)

    // deploy escrow contract
    const tx = await factory.create(calldata)

    const receipt = await tx.wait(tx)

    const expectedEvent = 'InstanceCreated'
    const createFeedEvent = receipt.events.find(
        emittedEvent => emittedEvent.event === expectedEvent,
        'There is no such event',
    )

    const escrowAddress = createFeedEvent.args.instance;
    const escrowContract = new ethers.Contract(escrowAddress, CountdownGriefingEscrowABI.compilerOutput.abi, wallet)

    return escrowContract
}

async function mintAndApproveTokens(_amount, from, to) {
    const stakeAmount = ethers.utils.parseEther(_amount) 
    let mockNMRFrom = new ethers.Contract('0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671', mockNMRABI.compilerOutput.abi, from)

    // Mint Tokens to 
    await mockNMRFrom.mintMockTokens(from.address, stakeAmount)
    await mockNMRFrom.approve(to, stakeAmount)
}

// not finished
async function depositStake(escrowContractAddres, seller) {
    let escrowSeller = new ethers.Contract(escrowContractAddres, escrowABI.compilerOutput.abi, seller);

    let txDeposit = await escrowSeller.depositStake();
    let txReceipt = await txDeposit.wait();
    let expectedEvent = 'StakeDeposited';
    const createFeedEvent = txReceipt.events.find(
        emittedEvent => emittedEvent.event === expectedEvent,
        'There is no such event',
    )
}

async function depositPayment(escrowContractAddres, buyer) {
    // const paymentAmount = ethers.utils.parseEther(_paymentAmount) //should be 2

    let escrowBuyer = new ethers.Contract(escrowContractAddres, escrowABI.compilerOutput.abi, buyer);
    let tx = await escrowBuyer.depositPayment(); // this triggers following events: DepositIncreased, StakeAdded, PaymentDeposited, DeadlineSet
    let txReceipt = await tx.wait();
}


module.exports = {
    createEscrow,
    mintAndApproveTokens,
    depositStake,
    depositPayment,
}