const {ethers} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');

describe("BUY GMNMachineShop NFT", () => {
    let signers = []; //[0] -> Owner deploy, [1] -> minter, [2] -> user
    let GMNMachine;
    let GMNMachineShop;
    let TokenTest;

    const deployFixture = async() => {
        const TokenTestFactory = await ethers.getContractFactory("TokenTest");
        const GMNMFactory = await ethers.getContractFactory("GMNMachine");
        const GMNMShopFactory = await ethers.getContractFactory("GMNMachineShop");

        GMNMachine = await GMNMFactory.deploy();
        TokenTest = await TokenTestFactory.deploy("100000000000000000000000000000"); 
        GMNMachineShop = await GMNMShopFactory.deploy(GMNMachine.address, TokenTest.address);

        await GMNMachine.setCurrency(TokenTest.address);

        console.log("   signers 2 " + signers[2].address);
        await TokenTest.transfer(signers[2].address, ethers.utils.parseEther("10000"));
        await TokenTest.connect(signers[2]).approve(GMNMachine.address, ethers.utils.parseEther("1000000"));
        await TokenTest.connect(signers[2]).approve(GMNMachineShop.address, ethers.utils.parseEther("1000000"));
    };//End deployFixture

    before(async() => {
        signers = await ethers.getSigners();
        await deployFixture();
    });

    describe("Sign and Buy MachineShop NFT", () => {

        it("success grant minter role to signers[1]", async() => {
            console.log("       signers 1 " + signers[1].address);
            await GMNMachine.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
            const tx = await GMNMachineShop.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
            expect(await GMNMachineShop.hasRole(ethers.utils.id("MINTER_ROLE"), signers[1].address)).eq(true);
        });//End it

        it("success sign and buy many", async() => {
            const machineInfos = [
                {
                    name: "Machine 1",
                    kind: 1,
                    rarity: 0
                },
                {
                    name: "Machine 2",
                    kind: 2,
                    rarity: 0
                }
            ];

            const expiry = BigNumber.from(Math.floor(new Date().getTime() / 1000 + 2 * 86400));
            const price1Machine = ethers.utils.parseEther("2000");
            const numberMachine = machineInfos.length;
            let prices = [];
            let buySigs = [];

            for (let i = 0; i < numberMachine; i++) {
                prices.push(price1Machine);
            }

            for (let i = 0; i < numberMachine; i++) {
                let machineInfo = machineInfos[i];
                const hash = ethers.utils.solidityKeccak256(
                    ["address", "uint256", "string", "uint8", "uint8", "address", "uint256"],
                    [GMNMachineShop.address, price1Machine, machineInfo.name, machineInfo.kind, machineInfo.rarity, GMNMachine.address, expiry.add(i)]
                );
                const messageHashBinary = ethers.utils.arrayify(hash);
                const signature = await signers[1].signMessage(messageHashBinary);
                buySigs.push(signature);
            }

            let nftsHash = [];
            let buySigsHash = [];
            for (let i = 0; i < numberMachine; i++) {
                let machineInfo = machineInfos[i];
                let machHash = ethers.utils.solidityKeccak256(
                    ["string", "uint8", "uint8"],
                    [machineInfo.name, machineInfo.kind, machineInfo.rarity]
                );
                nftsHash.push(machHash);

                let buyHash = ethers.utils.solidityKeccak256(
                    ["bytes"], [buySigs[i]]
                );
                buySigsHash.push(buyHash);
            }

            let nftsSolidityKeccak256 = ethers.utils.solidityKeccak256(["bytes[]"], [nftsHash]);
            let machineHash = nftsSolidityKeccak256;

            let buySigsSolidityKeccak256 = ethers.utils.solidityKeccak256(["bytes[]"], [buySigsHash]);
            let buyHash = buySigsSolidityKeccak256;

            // msg.sender,
            //     machineHash,
            //     prices,
            //     buyHash,
            //     expire,
            //     address(this)
            let shopSignatureKeccak256 = ethers.utils.solidityKeccak256(
                ["address", "bytes", "uint256[]", "bytes", "uint256", "address"],
                [signers[2].address, machineHash, prices, buyHash, expiry, GMNMachineShop.address]
            );
            let shopSignatureMessageHashBinary = ethers.utils.arrayify(shopSignatureKeccak256);
            let shopSignature = await signers[1].signMessage(shopSignatureMessageHashBinary);
            
            let numberNFTBefore = await GMNMachine.balanceOf(signers[2].address);
            let tx = await GMNMachineShop.connect(signers[2]).buy(machineInfos, prices, buySigs, expiry, shopSignature);
            await tx.wait();
            let numberNFTAfter = await GMNMachine.balanceOf(signers[2].address);

            console.log("       NumberNFTBefore", numberNFTBefore);
            console.log("       NumberNFTAfter", numberNFTAfter);
            console.log("       Bought Machine 1", await GMNMachine.getMachine(BigNumber.from(1)));
            console.log("       Bought Machine 2", await GMNMachine.getMachine(BigNumber.from(2)));

            expect(numberNFTAfter).gt(numberNFTBefore);
        });

    });//End Sign and Buy MachineShop NFT
});