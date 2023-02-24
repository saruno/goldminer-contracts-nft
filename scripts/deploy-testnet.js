// This is a script for deploying your contracts. You can adapt it to deploy
// yours, or create new ones.

const { sign } = require("crypto");
const path = require("path");
const CURRENCY_ADDRESS_BUSD = "0xb16ba303c1Fa64Dc8a91dCaF87D0299F85792B6A";

async function main() {
  // This is just a convenience check
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
        "gets automatically created and destroyed every time. Use the Hardhat" +
        " option '--network localhost'"
    );
  }

  // ethers is available in the global scope
  const [deployer] = await ethers.getSigners();
  const signers = await ethers.getSigners();
  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress()
  );
  console.log("Account balance:", (await deployer.getBalance()).toString())
  const minterAddress = await signers[1].getAddress();
  console.log("Minter address:", minterAddress);
  
  const GMNCFactory = await ethers.getContractFactory("GMNCharacter");
  const GMNCharacter = await GMNCFactory.deploy();
  await GMNCharacter.deployed();
  await GMNCharacter.setCurrency(CURRENCY_ADDRESS_BUSD);

  const GMNCShopFactory = await ethers.getContractFactory("GMNCharacterShop");
  const GMNCharacterShop = await GMNCShopFactory.deploy(GMNCharacter.address, CURRENCY_ADDRESS_BUSD);
  await GMNCharacterShop.deployed();

  const GMNMFactory = await ethers.getContractFactory("GMNMachine");
  const GMNMachine = await GMNMFactory.deploy();
  await GMNMachine.deployed();
  await GMNMachine.setCurrency(CURRENCY_ADDRESS_BUSD);

  const GMNMShopFactory = await ethers.getContractFactory("GMNMachineShop"); 
  const GMNMachineShop = await GMNMShopFactory.deploy(GMNMachine.address, CURRENCY_ADDRESS_BUSD);
  await GMNMachineShop.deployed();
  
  console.log("GMNCharacter address:", GMNCharacter.address);
  console.log("GMNCharacterShop address:", GMNCharacterShop.address);
  console.log("GMNMachine address:", GMNMachine.address);
  console.log("GMNMachineShop address:", GMNMachineShop.address);

  // We also save the contract's artifacts and address in the frontend directory
  saveFrontendFiles(GMNCharacter, "GMNCharacter");
  saveFrontendFiles(GMNCharacterShop, "GMNCharacterShop");
  saveFrontendFiles(GMNMachine, "GMNMachine");
  saveFrontendFiles(GMNMachineShop, "GMNMachineShop");

  await GMNCharacter.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
  await GMNCharacterShop.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
  await GMNMachine.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
  await GMNMachineShop.grantRole(ethers.utils.id("MINTER_ROLE"), signers[1].address);
}

function saveFrontendFiles(token, contractName) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts-tesnet");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, contractName + "-address.json"),
    JSON.stringify({ [contractName]: token.address }, undefined, 2)
  );

  const TokenArtifact = artifacts.readArtifactSync(contractName);

  fs.writeFileSync(
    path.join(contractsDir, contractName + ".json"),
    JSON.stringify(TokenArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
