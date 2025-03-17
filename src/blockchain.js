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
    
        // Correct height
        if (newBlock.height !== lastBlock.height + 1) {
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
    
    // La validación depende más de la elección del validador que de resolver puzzles como en PoW
    isValidHash(hash) {
        return typeof hash === 'string' && hash.length > 0;
    }

}

module.exports = Blockchain;
