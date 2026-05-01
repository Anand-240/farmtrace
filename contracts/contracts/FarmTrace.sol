// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract FarmTrace is Initializable, AccessControlUpgradeable, UUPSUpgradeable {

    struct Produce {
        bytes32 id;
        string farmerName;
        string cropType;
        string origin;
        uint256 farmPrice;
        uint256 timestamp;
        bool exists;
    }

    bytes32 public constant SCANNER_ROLE = keccak256("SCANNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    mapping(bytes32 => Produce) public produces;

    event ProduceRegistered(bytes32 indexed id, string cropType, address farmer, uint256 timestamp);
    event ProduceTransferred(bytes32 indexed id, address from, address to, uint256 price);
    event CheckpointAdded(bytes32 indexed produceId, address from, address to, uint256 price, string location, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SCANNER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}

    function registerProduce(
        string memory farmerName,
        string memory cropType,
        string memory origin,
        uint256 farmPrice
    ) public onlyRole(SCANNER_ROLE) returns (bytes32) {
        bytes32 id = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, cropType)
        );

        produces[id] = Produce({
            id: id,
            farmerName: farmerName,
            cropType: cropType,
            origin: origin,
            farmPrice: farmPrice,
            timestamp: block.timestamp,
            exists: true
        });

        emit ProduceRegistered(id, cropType, msg.sender, block.timestamp);
        return id;
    }

    function transferProduce(
        bytes32 produceId,
        address toAddress,
        uint256 price,
        string memory location
    ) public onlyRole(SCANNER_ROLE) {
        require(produces[produceId].exists, "Produce nahi mila");
        require(price > 0, "Price zero nahi ho sakta");

        emit CheckpointAdded(produceId, msg.sender, toAddress, price, location, block.timestamp);
        emit ProduceTransferred(produceId, msg.sender, toAddress, price);
    }

    function getProduce(bytes32 produceId)
        public view returns (Produce memory) {
        return produces[produceId];
    }
}
