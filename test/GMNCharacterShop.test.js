const {ethers} = require('hardhat');
const {expect} = require('chai');
const {BigNumber} = require('ethers');

describe("BUY GMNCharacterShop NFT", () => {

    let signers = []; //[0] -> Owner deploy, [1] -> minter, [2] -> user
    let GMNCharacter;
    let GMNCharacterShop;
    let TokenTest;

    const deployFixture = async() => {
        const TokenTestFactory = await ethers.getContractFactory("TokenTest");
        const GMNCFactory = await ethers.getContractFactory("GMNCharacter");
        const GMNCShopFactory = await ethers.getContractFactory("GMNCharacterShop");
        
        GMNCharacter = await GMNCFactory.deploy();
        TokenTest = await TokenTestFactory.deploy("100000000000000000000000000000"); 
        GMNCharacterShop = await GMNCShopFactory.deploy(GMNCharacter.address, TokenTest.address);

        await GMNCharacter.setCurrency(TokenTest.address);
        console.log("   signers 2 " + signers[2].address);
        await TokenTest.transfer(signers[2].address, ethers.utils.parseEther("10000"));
        await TokenTest.connect(signers[2]).approve(GMNCharacter.address, ethers.utils.parseEther("1000000"));
        await TokenTest.connect(signers[2]).approve(GMNCharacterShop.address, ethers.utils.parseEther("1000000"));
        console.log("   Character Address " + GMNCharacter.address);
        console.log("   CharacterShop Address " + GMNCharacterShop.address);
    };//End deployFixture

    before(async() => {
        signers = await ethers.getSigners();
        await deployFixture();
    });

    describe("Sign and Buy CharacterShop NFT", () => {

        it("success grant minter role to signers[1]", async() => {
            console.log("       signers 1 " + signers[1].address);
            const tx1 = await GMNCharacter.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
            await tx1.wait();
            const tx2 = await GMNCharacterShop.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
            await tx2.wait();
            expect(await GMNCharacterShop.hasRole(ethers.utils.id("MINTER_ROLE"), signers[1].address)).eq(true);
        }); //End it

        it("success sign and buy many", async() => {
            const characterInfos = [
                {
                    name: "Character 1",
                    kind: 1,
                    sex: 1,
                    rarity: 3
                },
                {
                    name: "Character 2",
                    kind: 2,
                    sex: 1,
                    rarity: 1
                }
            ];

            const expiry = BigNumber.from(Math.floor(new Date().getTime() / 1000 + 2 * 86400));
            console.log("       expiry", expiry);
            const price1Character = ethers.utils.parseEther("2000");
            const numberCharacter = characterInfos.length;
            let prices = [];
            let buySigs = [];

            for (let i = 0; i < numberCharacter; i++) {
                prices.push(price1Character);
            }

            for (let i = 0; i < numberCharacter; i++) {
                let characterInfo = characterInfos[i];
                let hash = ethers.utils.solidityKeccak256(
                    ["address", "uint256", "string", "uint8", "uint8", "uint8", "address", "uint256"],
                    [GMNCharacterShop.address, price1Character, characterInfo.name, characterInfo.kind, characterInfo.sex, characterInfo.rarity, GMNCharacter.address, expiry.add(i)]
                );
    
                let messageHashBinary = ethers.utils.arrayify(hash);
                let signature = await signers[1].signMessage(messageHashBinary);
                buySigs.push(signature);
            }

            let nftsHash = [];
            let buySigsHash = [];
            for (let i = 0; i < numberCharacter; i++) {
                let characterInfo = characterInfos[i];
                let charHash = ethers.utils.solidityKeccak256(
                    ["string", "uint8", "uint8", "uint8"],
                    [characterInfo.name, characterInfo.kind, characterInfo.sex, characterInfo.rarity]
                );
                nftsHash.push(charHash);

                let buyHash = ethers.utils.solidityKeccak256(
                    ["bytes"], [buySigs[i]]
                );
                buySigsHash.push(buyHash);
            }

            let nftsSolidityKeccak256 = ethers.utils.solidityKeccak256(["bytes[]"], [nftsHash]);
            let characterHash = nftsSolidityKeccak256;

            let buySigsSolidityKeccak256 = ethers.utils.solidityKeccak256(["bytes[]"], [buySigsHash]);
            let buyHash = buySigsSolidityKeccak256;
            // msg.sender,
            //     heroHash,
            //     prices,
            //     buyHash,
            //     expire,
            //     address(this)
            let shopSignatureKeccak256 = ethers.utils.solidityKeccak256(
                ["address", "bytes", "uint256[]", "bytes", "uint256", "address"],
                [signers[2].address, characterHash, prices, buyHash, expiry, GMNCharacterShop.address]
            );
            let shopSignatureMessageHashBinary = ethers.utils.arrayify(shopSignatureKeccak256);
            let shopSignature = await signers[1].signMessage(shopSignatureMessageHashBinary);
            console.log("ShopSignature ", shopSignature);
            
            /*
            let numberNFTBefore = await GMNCharacter.balanceOf(signers[2].address);
            let tx = await GMNCharacterShop.connect(signers[2]).buy(characterInfos, prices, buySigs, expiry, shopSignature);
            const txReceipt = await tx.wait();
            // console.log("       Tx", tx);
            // console.log("       TxReceipt", txReceipt);
            // console.log("       Events", JSON.stringify(txReceipt.events));
            let numberNFTAfter = await GMNCharacter.balanceOf(signers[2].address);

            console.log("       NumberNFTBefore", numberNFTBefore);
            console.log("       NumberNFTAfter", numberNFTAfter);
            console.log("       Bought Character 1", await GMNCharacter.getCharacter(BigNumber.from(1)));
            console.log("       Bought Character 2", await GMNCharacter.getCharacter(BigNumber.from(2)));

            expect(numberNFTAfter).gt(numberNFTBefore);
            */
           await expect(GMNCharacterShop.connect(signers[2]).buy(characterInfos, prices, buySigs, expiry, shopSignature))
           .to.emit(GMNCharacterShop, "Sold");
        });
    });
});