const {ethers} = require("hardhat");
const {expect} = require("chai");
const {BigNumber} = require("ethers");

describe("BUY GMNMachine NFT", () => {

    let signers = []; //[0] -> Owner deploy, [1] -> minter, [2] -> user
    let GMNMachine;
    let TokenTest;

    const deployFixture = async() => {
        const TokenTestFactory = await ethers.getContractFactory("TokenTest");
        const GMNMFactory = await ethers.getContractFactory("GMNMachine");
        GMNMachine = await GMNMFactory.deploy();
        TokenTest = await TokenTestFactory.deploy("100000000000000000000000000000");
        await GMNMachine.setCurrency(TokenTest.address);
        await TokenTest.transfer(signers[2].address, ethers.utils.parseEther("10000"));
        await TokenTest.connect(signers[2]).approve(GMNMachine.address, ethers.utils.parseEther("1000000"));
    }; //End deployFixture

    before(async() => {
        signers = await ethers.getSigners();
        await deployFixture();
    }); // End before

    describe("Sign And Buy Machine NFT", () => {

        it("success grant minter role to signers[1]", async() => {
            const tx = await GMNMachine.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
            await tx.wait();
            expect(await GMNMachine.hasRole(ethers.utils.id("MINTER_ROLE"), signers[1].address)).eq(true);
        }); // End it

        it("success sign and buy", async() => {
            const machineInfo = {
                name: "Machine 1",
                kind: 1,
                rarity: 0
            };

            const expiry = BigNumber.from(Math.floor(new Date().getTime() / 1000 + 2 * 86400));
            const price = ethers.utils.parseEther("2000");

            const hash = ethers.utils.solidityKeccak256(
                ["address", "uint256", "string", "uint8", "uint8", "address", "uint256"],
                [signers[2].address, price, machineInfo.name, machineInfo.kind, machineInfo.rarity, GMNMachine.address, expiry]
            );
            const messageHashBinary = ethers.utils.arrayify(hash);
            const signature = await signers[1].signMessage(messageHashBinary);

            let numberNFTBefore = await GMNMachine.balanceOf(signers[2].address);
            let tx = await GMNMachine.connect(signers[2]).buy(machineInfo, price, expiry, signature);
            await tx.wait();
            let numberNFTAfter = await GMNMachine.balanceOf(signers[2].address);

            console.log("       NumberNFTBefore", numberNFTBefore);
            console.log("       NumberNFTAfter", numberNFTAfter);
            console.log("       Bought Machine", await GMNMachine.getMachine(BigNumber.from(1)));

            expect(numberNFTAfter).gt(numberNFTBefore);
        });

    }); // End describe Sign And Buy Machine NFT

}); //End describe BUY GMNMachine NFT