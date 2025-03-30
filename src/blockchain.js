const Block = require("./block");

class Blockchain {
    constructor() {
        this.chain = [Block.genesis];
        this.validators = new Set();
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
    
        // Altura del bloque correcta
        if (newBlock.height !== lastBlock.height + 1) {
            return false;
        }
    
        // Hash previo correcto
        if (newBlock.previousHash !== lastBlock.hash) {
            return false;
        }
    
        // Se comprueba que el validador es un participante
        if (!this.validators.has(newBlock.validator)) {
            return false;
        }
    
        return true;
    }  

}

module.exports = Blockchain;
