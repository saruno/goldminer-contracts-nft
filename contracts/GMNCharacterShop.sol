// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// import "hardhat/console.sol";

interface IGMNCharacter {
    enum Sex {
        FEMALE,
        MALE
    }

    enum Rarity {
        COMMON,
        RARE,
        EPIC,
        LEGEND
    }

    struct CharacterInfo {
        string name;
        uint8 kind;
        Sex sex;
        Rarity rarity;
    }

    function buy(CharacterInfo calldata character, uint256 price, uint256 expire, bytes memory signature) external payable returns(uint256);

    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract GMNCharacterShop is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    IGMNCharacter public GMNCharacter;
    IERC20 public TOKEN;

    mapping(bytes => bool) private boughtSignature;

    event Sold(uint256[] newItemIds, address player, IGMNCharacter.CharacterInfo[] characters, uint256[] prices, uint256 expire, bytes signature);
    event SetCurrency(address currency);

    constructor(address _GMNC, address _currency) {
        GMNCharacter = IGMNCharacter(_GMNC);
        TOKEN = IERC20(_currency);
        TOKEN.approve(_GMNC, type(uint256).max);
        _setRoleAdmin(MINTER_ROLE, OWNER_ROLE);
        _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
        _setupRole(OWNER_ROLE, msg.sender);
    }

    //=== USER FUNCTION===
    function buy(IGMNCharacter.CharacterInfo[] calldata characters, uint256[] calldata prices, bytes[] calldata buySigs, uint256 expire, bytes memory signature) external payable returns (uint256[] memory newItemIds){
        uint256 quantity = characters.length;
        require(prices.length == quantity, "CharacterShop::miss match prices");
        require(expire >= block.timestamp, "CharacterShop::signature expired");
        require(boughtSignature[signature] == false, "CharacterShop::signature has been used");
        boughtSignature[signature] = true;
        require(verifySignature(characters, prices, buySigs, expire, signature), "CharacterShop::wrong signature");
        uint256 amount;
        for (uint256 i; i < quantity; i++) {
            amount += prices[i];
        }
        bool transferred = TOKEN.transferFrom(msg.sender, address(this), amount);
        require(transferred, "cannot transfer ERC20");
        newItemIds = new uint256[](quantity);
        for (uint256 i; i < quantity; i++) {
            uint256 newItemId = GMNCharacter.buy(characters[i], prices[i], expire + i, buySigs[i]);
            GMNCharacter.transferFrom(address(this), msg.sender, newItemId);
            newItemIds[i] = newItemId;
        }
        emit Sold(newItemIds, msg.sender, characters, prices, expire, signature);
    }

    //=== INTERNAL FUNCTION===
    function getHash(IGMNCharacter.CharacterInfo[] calldata characters, bytes[] calldata buySigs) internal pure returns (bytes32 characterHash, bytes32 buyHash) {
        uint256 quantity = characters.length;
        require(buySigs.length == quantity, "miss match sigs");
        bytes32[] memory nftsHash = new bytes32[](quantity);
        bytes32[] memory buySigsHash = new bytes32[](quantity);
        for (uint256 i; i < quantity; i++) {
            nftsHash[i] = keccak256(abi.encodePacked(
                    characters[i].name,
                    characters[i].kind,
                    characters[i].sex,
                    characters[i].rarity
                ));
            buySigsHash[i] = keccak256(abi.encodePacked(buySigs[i]));
        }
        characterHash = keccak256(abi.encodePacked(nftsHash));
        buyHash = keccak256(abi.encodePacked(buySigsHash));
        return (characterHash, buyHash);
    }

    function verifySignature(IGMNCharacter.CharacterInfo[] calldata characters, uint256[] calldata prices, bytes[] calldata buySigs, uint256 expire, bytes memory signature) public view returns (bool) {
        (bytes32 heroHash, bytes32 buyHash) = getHash(characters, buySigs);
        bytes32 hash = keccak256(abi.encodePacked(
                msg.sender,
                heroHash,
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