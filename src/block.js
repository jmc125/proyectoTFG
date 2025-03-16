const crypto = require('crypto');

class Block {
    constructor(height, previousHash, time, data, hash, validator) {
        this.height = height;
        this.previousHash = previousHash;
        this.time = time;
        this.data = data;
        this.hash = hash;
        this.validator = validator;
    }

    static get genesis() {
        const time = new Date ('2009-03-01').getTime();
        return new this(
            0,
            undefined,
            time,
            'Genesis Block',
            'genesis_hash',
            'genesis_validator',
        );
    }

    calculateHash(height, previousHash, time, data, validator) {
        const hashData = `${height}${previousHash}${time}${JSON.stringify(data)}${validator}`;
        return crypto.createHash('SHA256').update(hashData).digest('hex');
    }
    
}

module.exports = Block;
