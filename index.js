const express = require("express");
const bodyParser = require("body-parser");
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Blockchain = require("./src/blockchain")
const Block = require("./src/block")

const app = express();
const port = 3000;

let blockchain = new Blockchain();

// Middleware
app.use(bodyParser.urlencoded({ extended : true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// Se crea una carpeta llamada keys en caso de que no exista
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
}

// Claves RSA y registro de validadores
const validators = {};
['Validator_1', 'Validator_2', 'Validator_3'].forEach(validator => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Guardado de clave
    fs.writeFileSync(path.join(keysDir, `${validator}_private.pem`), privateKey);

    // Se almacena únicamente la clave pública en memoria
    validators[validator] = { publicKey };
    blockchain.validators.add(validator);
});

// Algoritmo de consenso PoS
function selectValidator() {
    // Lógica de selección de validador simulada
    const validators = Array.from(blockchain.validators);
    const randomIndex = Math.floor(Math.random() * validators.length);
    return validators[randomIndex];
}

// Rutas
app.get('/', (req, res) => {
    res.render('index', { blockchain: blockchain.chain });
});

app.post('/add-certificate', (req, res) => {
    const { certificateId, studentName, courseName } = req.body;
    const data = { certificateId, studentName, courseName };

    const lastBlock = blockchain.getLastBlock();
    const height = lastBlock.height + 1;
    const time = Date.now();
    const previousHash = lastBlock.hash;

    const validator = selectValidator();
    const publicKey = validators[validator].publicKey;

    // Se lee la clave privada desde la carpeta
    const privateKeyPath = path.join(keysDir, `${validator}_private.pem`);
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    // Se firma la transacción (certificado)
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(data));
    sign.end();
    const signature = sign.sign(privateKey, 'base64');

    const tempBlock = new Block();
    const hash = tempBlock.calculateHash(height, previousHash, time, data, validator);

    const newBlock = new Block(height, previousHash, time, { ...data, signature, publicKey }, hash, validator);

    if (blockchain.addBlock(newBlock)) {
        res.redirect('/');
    } else {
        res.send('Error al añadir el bloque.');
    }
});

app.get('/verify', (req, res) => {
    res.render('verify', { result: null, validSignature: null, searchCompleted: false });
});

app.post('/verify', (req, res) => {
    const { certificateId } = req.body;
    const found = blockchain.chain.find(block => block.data.certificateId === certificateId);

    if (found) {
        const { signature, publicKey, ...certData } = found.data;

        try {
            const verify = crypto.createVerify('SHA256');
            verify.update(JSON.stringify(certData));
            verify.end();
            const isValidSignature = verify.verify(publicKey, signature, 'base64');

            res.render('verify', { result: found, validSignature: isValidSignature, searchCompleted: true });
        } catch (err) {
            res.render('verify', { result: found, validSignature: false, searchCompleted: true });
        }
    } else {
        res.render('verify', { result: null, validSignature: null, searchCompleted: true });
    }
});


// Lista de validadores con claves públicas
app.get('/validators', (req, res) => {
    const validatorsWithKeys = Object.entries(validators).map(([name, keys]) => ({
        name,
        publicKey: keys.publicKey
    }));
    res.render('validators', { validators: validatorsWithKeys });
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
