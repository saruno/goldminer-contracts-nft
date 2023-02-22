// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IGMNMachine {
    enum Rarity {
        COMMON,
        RARE,
        EPIC,
        LEGEND
    }

    struct MachineInfo {
        string name;
        uint8 kind;
        Rarity rarity;
    }

    function buy(MachineInfo calldata machine, uint256 price, uint256 expire, bytes memory signature) external payable returns(uint256);

    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract GMNMachineShop is AccessControl {
    using ECDSA for bytes32;
    
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    IGMNMachine public GMNMachine;
    IERC20 public TOKEN;

    mapping(bytes => bool) private boughtSignature;

    event Sold(uint256[] newItemIds, address player, IGMNMachine.MachineInfo[] machines, uint256[] prices, uint256 expire, bytes signature);
    event SetCurrency(address currency);

    constructor(address _GMNM, address _currency) {
        GMNMachine = IGMNMachine(_GMNM);
        TOKEN = IERC20(_currency);
        TOKEN.approve(_GMNM, type(uint256).max);
        _setRoleAdmin(MINTER_ROLE, OWNER_ROLE);
        _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
        _setupRole(OWNER_ROLE, msg.sender);
    }

    //=== USER FUNCTION===
    function buy(IGMNMachine.MachineInfo[] calldata machines, uint256[] calldata prices, bytes[] calldata buySigs, uint256 expire, bytes memory signature) external payable returns (uint256[] memory newItemIds){
        uint256 quantity = machines.length;
        require(prices.length == quantity, "MachineShop::miss match prices");
        require(expire >= block.timestamp, "MachineShop::signature expired");
        require(boughtSignature[signature] == false, "MachineShop::signature has been used");
        boughtSignature[signature] = true;
        require(verifySignature(machines, prices, buySigs, expire, signature), "MachineShop::wrong signature");
        uint256 amount;
        for (uint256 i; i < quantity; i++) {
            amount += prices[i];
        }
        bool transferred = TOKEN.transferFrom(msg.sender, address(this), amount);
        require(transferred, "cannot transfer ERC20");
        newItemIds = new uint256[](quantity);
        for (uint256 i; i < quantity; i++) {
            uint256 newItemId = GMNMachine.buy(machines[i], prices[i], expire + i, buySigs[i]);
            GMNMachine.transferFrom(address(this), msg.sender, newItemId);
            newItemIds[i] = newItemId;
        }
        emit Sold(newItemIds, msg.sender, machines, prices, expire, signature);
    }

    //=== INTERNAL FUNCTION===
    function getHash(IGMNMachine.MachineInfo[] calldata machines, bytes[] calldata buySigs) internal pure returns (bytes32 machineHash, bytes32 buyHash) {
        uint256 quantity = machines.length;
        require(buySigs.length == quantity, "miss match sigs");
        bytes32[] memory nftsHash = new bytes32[](quantity);
        bytes32[] memory buySigsHash = new bytes32[](quantity);
        for (uint256 i; i < quantity; i++) {
            nftsHash[i] = keccak256(abi.encodePacked(
                    machines[i].name,
                    machines[i].kind,
                    machines[i].rarity
                ));
            buySigsHash[i] = keccak256(abi.encodePacked(buySigs[i]));
        }
        machineHash = keccak256(abi.encodePacked(nftsHash));
        buyHash = keccak256(abi.encodePacked(buySigsHash));
        return (machineHash, buyHash);
    }

    function verifySignature(IGMNMachine.MachineInfo[] calldata machines, uint256[] calldata prices, bytes[] calldata buySigs, uint256 expire, bytes memory signature) public view returns (bool) {
        (bytes32 machineHash, bytes32 buyHash) = getHash(machines, buySigs);
        bytes32 hash = keccak256(abi.encodePacked(
                msg.sender,
                machineHash,
                prices,
                buyHash,
                expire,
                address(this)
        ));
        bytes32 messageHash = hash.toEthSignedMessageHash();
        address signatory = messageHash.recover(signature);
        return hasRole(MINTER_ROLE, signatory);
    }

    //=== OWNER FUNCTION===

    function setCurrency(address _currency) external onlyRole(OWNER_ROLE) {
        TOKEN = IERC20(_currency);
        emit SetCurrency(_currency);
    }
    //===EMERGENCY FUNCTION===
    function forceReturnERC20(
        address token,
        uint256 amount,
        address sendTo
    ) external onlyRole(OWNER_ROLE) {
        IERC20(token).transfer(sendTo, amount);
    }

    function forceReturnNative(uint256 amount, address payable sendTo) external onlyRole(OWNER_ROLE) {
        (bool success,) = sendTo.call{value : amount}("");
        require(success, "withdraw failed");
    }

    function forceReturnERC721(
        address sendTo,
        address token,
        uint256 tokenId
    ) external onlyRole(OWNER_ROLE) {
        IERC721(token).transferFrom(address(this), sendTo, tokenId);
    }

    receive() payable external {}
}