require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();
// The next line is part of the sample project, you don't need it in your
// project. It imports a Hardhat task definition, that can be used for
// testing the frontend.
require("./tasks/accounts");
require("./tasks/balances")

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 1337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
  bsc: 56,
  bsc_testnet: 97,
};

// Ensure that we have all the environment variables we need.
const mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

function createTestnetConfig(network) {
  const url = "https://" + network + ".infura.io/v3/9324ed499afb463485aea6a88fe7777c";
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url,
  };
}

function createBSCTestnetConfig() {
  const url = "https://data-seed-prebsc-1-s1.binance.org:8545";
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds["bsc_testnet"],
    url,
    gas: 2500000,
  };
}

function createBSCConfig(){
  const url = "https://bsc-dataseed1.ninicoin.io/";
  return {
    accounts: {
      count: 10,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds["bsc"],
    url,
    gas: 2500000,
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  solidity: "0.8.17",
  gasReporter: {
    currency: "USD",
    enabled: true,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      chainId: chainIds.hardhat // We set 1337 to make interacting with MetaMask simpler
    },
    goerli: createTestnetConfig("goerli"),
    kovan: createTestnetConfig("kovan"),
    rinkeby: createTestnetConfig("rinkeby"),
    ropsten: createTestnetConfig("ropsten"),
    bsc_testnet: createBSCTestnetConfig(),
    bsc: createBSCConfig(),
  }
};
