pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract GMNCharacter is AccessControl, ERC721Enumerable {
    using ECDSA for bytes32;

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant OPERATION_ROLE = keccak256("OPERATION_ROLE");

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
        uint256 kind;
        Sex sex;
        Rarity rarity;
    }

    string private baseUri;
    address private currency;
    address public revenueAddress;

    mapping(uint256 => CharacterInfo) private characters;
    mapping(uint256 => string) private tokenURIs;
    mapping(bytes => bool) private boughtSignature;

    event Minted(address player, uint256 tokenId, CharacterInfo info);
    event SetBaseUri(string baseUri);
    event ChangeName(uint256 tokenId, string name);
    event Sold(uint256 newTokenId, address player, CharacterInfo characterInfo, uint256 price);
    event UsedSignature(bytes signature);
    event SetCurrency(address currency);
    event SetRevenueAddress(address revenueAddress);
    event WithdrawRevenue(address revenueAddress, uint256 amount);

    constructor() ERC721("GoldMinerNFT Character", "GMNC") {
        baseUri = "https://api.goldminernft.xyz/character/metadata/";

        _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
        _setRoleAdmin(MINTER_ROLE, OWNER_ROLE);
        _setRoleAdmin(OPERATION_ROLE, OWNER_ROLE);

        _setupRole(OWNER_ROLE, msg.sender);
    }

    function getCharacter(uint256 tokenId) public view returns (CharacterInfo memory) {
        require(_exists(tokenId), "ERC721URIStorage: URI query for nonexistent token");
        return characters[tokenId];
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721: query for nonexistent token");
        return tokenURIs[tokenId];
    }
    
    function tokenIds(address user) public view returns(uint256[] memory ids) {
        uint _total = balanceOf(user);
        ids = new uint256[](_total);
        for (uint i = 0; i < _total; i++) {
            ids[i] = tokenOfOwnerByIndex(user, i);
        }
    }

    //=== USER FUNCTION===
    function buy(CharacterInfo calldata character, uint256 price, uint256 expire, bytes memory signature) external payable returns(uint256) {
        require(verifySignature(character, price, expire, signature), "Invalid Signature");

        if (currency == address(0)) {
            require(msg.value >= price, "Balance is not enough to pay fee");
        } else {
            IERC20 token = IERC20(currency);
            bool transferred = token.transferFrom(msg.sender, address(this), price);
            require(transferred, "Cannot transfer ERC20 Token to pay nft");
        }
        uint256 newTokenId = mint(msg.sender, character);
        emit Sold(newTokenId, msg.sender, character, price);
        return newTokenId;
    }

    //=== INTERNAL FUNCTION===
    function mint(address player, CharacterInfo memory info) internal returns(uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _mint(player, newTokenId);

        characters[newTokenId] = info;
        tokenURIs[newTokenId] = string(abi.encodePacked(baseUri, uint2String(newTokenId)));

        emit Minted(player, newTokenId, info);

        return newTokenId;
    } 

    function verifySignature(CharacterInfo memory info, uint256 price, uint256 expire, bytes memory signature) internal returns(bool) {
        require(boughtSignature[signature] == false, "This signature has been used");
        boughtSignature[signature] = true;
        require(expire >= block.timestamp, "signature expired");
        bytes32 hash = keccak256(abi.encodePacked(
            msg.sender,
            price,
            info.name,
            info.kind,
            info.sex,
            info.rarity,
            address(this),
            expire
        ));
        bytes32 messageHash = hash.toEthSignedMessageHash();
        address signatory = messageHash.recover(signature);
        emit UsedSignature(signature);
        return hasRole(MINTER_ROLE, signatory);
    }

    //=== OPERATION FUNCTION===
    function withdrawRevenue() external onlyRole(OPERATION_ROLE) {
        require(revenueAddress != address(0), "Must be set revenue address first");
        IERC20 token = IERC20(currency);
        uint256 balanceOf = token.balanceOf(address(this));
        bool transferred = token.transfer(revenueAddress, balanceOf);
        require(transferred, "Error when transfer ERC20 token");
        emit WithdrawRevenue(revenueAddress, balanceOf);
    }
    function changeName(uint256 tokenId, string calldata name) external onlyRole(OPERATION_ROLE) {
        require(_exists(tokenId), "query for nonexistent token");
        characters[tokenId].name = name;
        emit ChangeName(tokenId, name);
    }

    //=== OWNER FUNCTION===
    function setRevenueAddress(address _revenue) external onlyRole(OWNER_ROLE) {
        revenueAddress = _revenue;
        emit SetRevenueAddress(_revenue);
    }

    function setCurrency(address _currency) external onlyRole(OWNER_ROLE) {
        currency = _currency;
        emit SetCurrency(_currency);
    }

    function setBaseUri(string calldata _baseUri) external onlyRole(OWNER_ROLE) {
        baseUri = _baseUri;
        emit SetBaseUri(_baseUri);
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
        ERC721(token).transferFrom(address(this), sendTo, tokenId);
    }    

    //=== UTILITY FUNCTION===
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function uint2String(uint256 x) private pure returns (string memory) {
        if (x > 0) {
            string memory str;
            while (x > 0) {
                str = string(abi.encodePacked(uint8(x % 10 + 48), str));
                x /= 10;
            }
            return str;
        }
        return "0";
    }

    receive() payable external {}
    
}