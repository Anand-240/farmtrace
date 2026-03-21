// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FarmTrace {

    struct Produce {
        bytes32 id;
        string farmerName;
        string cropType;
        string origin;
        uint256 farmPrice;
        uint256 timestamp;
        bool exists;
    }

    struct Transfer {
        address from;
        address to;
        uint256 price;
        string location;
        uint256 timestamp;
    }

    mapping(bytes32 => Produce) public produces;
    mapping(bytes32 => Transfer[]) public transferHistory;

    event ProduceRegistered(bytes32 indexed id, string cropType, address farmer, uint256 timestamp);
    event ProduceTransferred(bytes32 indexed id, address from, address to, uint256 price);

    function registerProduce(
        string memory farmerName,
        string memory cropType,
        string memory origin,
        uint256 farmPrice
    ) public returns (bytes32) {
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
    ) public {
        require(produces[produceId].exists, "Produce nahi mila");
        require(price > 0, "Price zero nahi ho sakta");

        transferHistory[produceId].push(Transfer({
            from: msg.sender,
            to: toAddress,
            price: price,
            location: location,
            timestamp: block.timestamp
        }));

        emit ProduceTransferred(produceId, msg.sender, toAddress, price);
    }

    function getHistory(bytes32 produceId)
        public view returns (Transfer[] memory) {
        return transferHistory[produceId];
    }

    function getProduce(bytes32 produceId)
        public view returns (Produce memory) {
        return produces[produceId];
    }
}
