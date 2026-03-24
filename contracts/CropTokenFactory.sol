// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CropToken
 * @notice ERC-20 token representing fractional ownership of a crop harvest.
 *         Each listing on AgriToken deploys one CropToken contract.
 */
contract CropToken is ERC20, Ownable {
    string  public cropType;
    uint256 public pricePerTokenWei;
    uint256 public harvestDate;
    bool    public payoutTriggered;

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 paid);
    event PayoutTriggered(uint256 totalPayout);

    constructor(
        string  memory _cropType,
        uint256 _totalSupply,
        uint256 _pricePerTokenWei,
        uint256 _harvestDate,
        address _farmer
    ) ERC20(
        string(abi.encodePacked("AgriTok-", _cropType)),
        string(abi.encodePacked("AT", _cropType))
    ) Ownable(_farmer) {
        cropType         = _cropType;
        pricePerTokenWei = _pricePerTokenWei;
        harvestDate      = _harvestDate;
        _mint(_farmer, _totalSupply * 10 ** decimals());
    }

    /**
     * @notice Buy tokens by sending BNB. Tokens transferred from farmer to buyer.
     * @param amount Number of whole tokens to buy.
     */
    function buyTokens(uint256 amount) external payable {
        uint256 cost = amount * pricePerTokenWei;
        require(msg.value >= cost, "Insufficient BNB sent");
        uint256 tokenAmount = amount * 10 ** decimals();
        require(balanceOf(owner()) >= tokenAmount, "Not enough tokens available");

        _transfer(owner(), msg.sender, tokenAmount);

        // Refund excess BNB
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        // Forward payment to farmer
        payable(owner()).transfer(cost);

        emit TokensPurchased(msg.sender, amount, cost);
    }

    /**
     * @notice Trigger payout to all token holders. Only callable by owner (farmer) or
     *         via the factory owner (admin). In a production build this would be
     *         called by a verified oracle after harvest confirmation.
     */
    function triggerPayout() external payable onlyOwner {
        require(!payoutTriggered, "Payout already triggered");
        payoutTriggered = true;
        emit PayoutTriggered(msg.value);
    }
}

/**
 * @title CropTokenFactory
 * @notice Deploys a new CropToken contract for each crop listing on AgriToken.
 */
contract CropTokenFactory is Ownable {
    address[] public allTokens;

    event CropTokenCreated(
        address indexed tokenAddress,
        address indexed farmer,
        string  cropType,
        uint256 totalSupply,
        uint256 pricePerTokenWei,
        uint256 harvestDate
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Deploy a new CropToken. Called by the farmer via the AgriToken UI.
     * @param cropType          e.g. "maize", "rice"
     * @param totalSupply       Number of whole tokens (1 token = 1 kg)
     * @param pricePerTokenWei  Price per token in wei (BNB)
     * @param harvestDate       Unix timestamp of expected harvest
     * @return tokenAddress     Address of the deployed CropToken contract
     */
    function createCropToken(
        string  memory cropType,
        uint256 totalSupply,
        uint256 pricePerTokenWei,
        uint256 harvestDate
    ) external returns (address tokenAddress) {
        CropToken token = new CropToken(
            cropType,
            totalSupply,
            pricePerTokenWei,
            harvestDate,
            msg.sender
        );
        allTokens.push(address(token));

        emit CropTokenCreated(
            address(token),
            msg.sender,
            cropType,
            totalSupply,
            pricePerTokenWei,
            harvestDate
        );

        return address(token);
    }

    /**
     * @notice Buy tokens on a specific CropToken contract.
     *         Convenience wrapper so the UI only needs the factory address.
     */
    function buyTokens(address tokenAddress, uint256 amount) external payable {
        CropToken(tokenAddress).buyTokens{ value: msg.value }(amount);
    }

    /**
     * @notice Admin-only payout trigger (used by AgriToken admin after harvest verification).
     */
    function triggerPayout(address tokenAddress) external payable onlyOwner {
        CropToken(tokenAddress).triggerPayout{ value: msg.value }();
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    /**
     * @notice Read key info from a deployed CropToken. Convenience for the frontend.
     */
    function getTokenInfo(address tokenAddress) external view returns (
        string memory cropType,
        uint256 totalSupply,
        uint256 pricePerToken,
        uint256 harvestDate,
        bool    isClosed
    ) {
        CropToken token = CropToken(tokenAddress);
        return (
            token.cropType(),
            token.totalSupply(),
            token.pricePerTokenWei(),
            token.harvestDate(),
            token.payoutTriggered()
        );
    }
}
