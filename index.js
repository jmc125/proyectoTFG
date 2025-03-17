const express = require("express");
const bodyParser = require("body-parser");
const Blockchain = require("./src/blockchain")
const Block = require("./src/block")

const app = express();
const port = 3000;

let blockchain = new Blockchain();

// Middleware
app.use(bodyParser.urlencoded({ extended : true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Validators
blockchain.validators.add('Validator_1');
blockchain.validators.add('Validator_2');
blockchain.validators.add('Validator_3');

// PoS blockchain
function selectValidator() {
    // Simulated validator selection logic
    const validators = Array.from(blockchain.validators);
    const randomIndex = Math.floor(Math.random() * validators.length);
    return validators[randomIndex];
}

// Routes
app.get('/', (req, res) => {
    res.render('index', { blockchain: blockchain.chain });
});

app.post('/add-certificate', (req, res) => {
    const { certificateId, studentName, courseName } = req.body;
    const data = {
        certificateId,
        studentName,
        courseName
    };

    const lastBlock = blockchain.getLastBlock();
    const height = lastBlock.height + 1;
    const time = Date.now();
    const previousHash = lastBlock.hash;
    const validator = selectValidator();

    const tempBlock = new Block();
    const hash = tempBlock.calculateHash(height, previousHash, time, data, validator);

    const newBlock = new Block(height, previousHash, time, data, hash, validator);

    if (blockchain.addBlock(newBlock)) {
        res.redirect('/');
    } else {
        res.send('Error al añadir el bloque');
    }
});

app.get('/verify', (req, res) => {
    res.render('verify', { result: null });
});

app.post('/verify', (req, res) => {
    const { certificateId } = req.body;
    const found = blockchain.chain.find(block => block.data.certificateId === certificateId);
    res.render('verify', { result: found });
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
