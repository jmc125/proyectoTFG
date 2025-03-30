const crypto = require('crypto');

class MerkleTree {
    constructor(leaves) {
        this.leaves = leaves.map(data => crypto.createHash('sha256').update(data).digest('hex'));
        this.root = this.buildTree(this.leaves);
    }

    buildTree(nodes) {
        if (nodes.length === 1) return nodes[0];
        
        let newLevel = [];
        for (let i = 0; i < nodes.length; i += 2) {
            const left = nodes[i];
            const right = nodes[i + 1] || nodes[i];
            newLevel.push(crypto.createHash('sha256').update(left + right).digest('hex'));
        }
        return this.buildTree(newLevel);
    }
}

module.exports = MerkleTree;