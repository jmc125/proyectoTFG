const Block = require("./block");

class Blockchain {
    constructor() {
        this.chain = [Block.genesis];
        this.validators = new Set();
        this.difficulty = 2; // PoS difficulty
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock) {
        if (this.isValidBlock(newBlock)) {
            this.chain.push(newBlock);
            return true;
        }
        return false;
    }

    isValidBlock(newBlock) {
        const lastBlock = this.getLastBlock();
    
        // Correct index
        if (newBlock.index !== lastBlock.index + 1) {
            return false;
        }
    
        // Correct previous hash
        if (newBlock.previousHash !== lastBlock.hash) {
            return false;
        }
    
        // Valid hash
        if (!this.isValidHash(newBlock.hash)) {
            return false;
        }
    
        // Validator is a valid participant
        if (!this.validators.has(newBlock.validator)) {
            return false;
        }
    
        return true;
    }
    
    isValidHash(hash) {
        const prefix = '0'.repeat(this.difficulty);
        return hash.startsWith(prefix);
    }

}

module.exports = Blockchain;
