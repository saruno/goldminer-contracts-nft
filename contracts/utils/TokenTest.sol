// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenTest is ERC20 {
    
    constructor(uint initialSupply) ERC20("Token Test", "Token Test") {
        _mint(msg.sender, initialSupply);
    }

    function mint(address user, uint256 amount) public {
        _mint(user, amount);
    }
}