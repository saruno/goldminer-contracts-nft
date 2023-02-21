const {ethers} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');

describe("BUY GMNCharacter NFT", () => {

    let signers = []; //[0] -> Owner deploy, [1] -> minter, [2] -> user
    let GMNCharacter;
    let TokenTest;

    const deployFixture = async() => {
        const TokenTestFactory = await ethers.getContractFactory("TokenTest");
        const GMNCFactory = await ethers.getContractFactory("GMNCharacter");
        GMNCharacter = await GMNCFactory.deploy();
        TokenTest = await TokenTestFactory.deploy("100000000000000000000000000000");       
        await GMNCharacter.setCurrency(TokenTest.address);
        console.log("   signers 2 " + signers[2].address);
        await TokenTest.transfer(signers[2].address, ethers.utils.parseEther("10000"));
        await TokenTest.connect(signers[2]).approve(GMNCharacter.address, ethers.utils.parseEther("1000000"));
    }; //End deployFixture

    before(async() => {
        signers = await ethers.getSigners();
        await deployFixture();
    });

    describe("Sign And Buy Character NFT", () => {

        it("success grant minter role to signers[1]", async() => {
            console.log("       signers 1 " + signers[1].address);
            const tx = await GMNCharacter.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
            await tx.wait();
            expect(await GMNCharacter.hasRole(ethers.utils.id("MINTER_ROLE"), signers[1].address)).eq(true);

        }); //End it

        it("success sign and buy", async () => {
            const characterInfo = {
                name: "Character 1",
                kind: 1,
                sex: 1,
                rarity: 3
            };

            const expiry = BigNumber.from(Math.floor(new Date().getTime() / 1000 + 2 * 86400));
            const price = ethers.utils.parseEther("2000");
            // msg.sender,
            // price,
            // info.name,
            // info.kind,
            // info.sex,
            // info.rarity,
            // address(this),
            // expire

            const hash = ethers.utils.solidityKeccak256(
                ["address", "uint256", "string", "uint8", "uint8", "uint8", "address", "uint256"],
                [signers[2].address, price, characterInfo.name, characterInfo.kind, characterInfo.sex, characterInfo.rarity, GMNCharacter.address, expiry]
            );

            const messageHashBinary = ethers.utils.arrayify(hash);
            const signature = await signers[1].signMessage(messageHashBinary);

            let numberNFTBefore = await GMNCharacter.balanceOf(signers[2].address);
            let tx = await GMNCharacter.connect(signers[2]).buy(characterInfo, price, expiry, signature);
            await tx.wait();
            let numberNFTAfter = await GMNCharacter.balanceOf(signers[2].address);

            console.log("       NumberNFTBefore", numberNFTBefore);
            console.log("       NumberNFTAfter", numberNFTAfter);
            console.log("       Bought Character", await GMNCharacter.getCharacter(BigNumber.from(1)));

            expect(numberNFTAfter).gt(numberNFTBefore);

            // let txVerifySignatureUsed = await GMNCharacter.connect(signers[2]).buy(characterInfo, price, expiry, signature);
            // await expect(txVerifySignatureUsed).to.be.revertedWith("This signature has been used");
        });

    }); //End describe Sign And Buy Character NFT

}); //End describe BUY GMNCharacter NFT