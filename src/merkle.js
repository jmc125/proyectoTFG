const crypto = require('crypto');

class MerkleTree {
    constructor(leaves) {
        this.leaves = leaves.map(data => this.hash(data));
        this.tree = this.buildTree(this.leaves);
    }

    hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    buildTree(leaves) {
        if (leaves.length === 0) return [];
        let tree = [leaves];
        while (tree[tree.length - 1].length > 1) {
            let level = [];
            let prevLevel = tree[tree.length - 1];
            for (let i = 0; i < prevLevel.length; i += 2) {
                if (i + 1 < prevLevel.length) {
                    level.push(this.hash(prevLevel[i] + prevLevel[i + 1]));
                } else {
                    level.push(prevLevel[i]); // Si es impar, se duplica el último
                }
            }
            tree.push(level);
        }
        return tree;
    }

    getRoot() {
        return this.tree.length > 0 ? this.tree[this.tree.length - 1][0] : null;
    }
}

module.exports = MerkleTree;