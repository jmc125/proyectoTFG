const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Blockchain = require("./src/blockchain")
const Block = require("./src/block")

const app = express();
const port = 3000;

let blockchain = new Blockchain();
const users = {};

// Middleware
app.use(bodyParser.urlencoded({ extended : true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
    secret: 'secreto_super_seguro',
    resave: false,
    saveUninitialized: true
}));

// Se crea una carpeta llamada keys en caso de que no exista
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
}

const validatorsPoS = ['Estudiante_1', 'Estudiante_2', 'Estudiante_3'];
const validatorsPoA = ['Universidad_1', 'Universidad_2', 'Universidad_3']; 
let poaIndex = 0;
const validators = {};

// Claves RSA y registro de validadores
[...validatorsPoS, ...validatorsPoA].forEach(validator => {
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

// // Selección de validador en PoS
function selectValidatorPoS() {
    const posValidators = Array.from(validatorsPoS);
    return posValidators[Math.floor(Math.random() * posValidators.length)];
}

// Función de selección de validador en PoA con rotación automática
function selectValidatorPoA() {
    const validator = validatorsPoA[poaIndex]; // Obtener validador actual
    poaIndex = (poaIndex + 1) % validatorsPoA.length; // Rotar validador
    return validator;
}
// Rutas de autenticación
app.get('/register', (req, res) => res.render('register'));
app.get('/login', (req, res) => res.render('login'));

app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (users[username]) {
        return res.send("Usuario ya registrado.");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = { password: hashedPassword, role };
    res.redirect('/login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.send("Usuario o contraseña incorrectos.");
    }

    req.session.user = { username, role: user.role };
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Ruta de la página principal
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('index', { blockchain: blockchain.chain, user: req.session.user });
});

app.post('/add-certificate', async (req, res) => {
    if (!req.session.user){
         return res.redirect('/login');
    } 

    const { studentName, courseName } = req.body;

    // Hay que asegurarse de que la blockchain tiene al menos un bloque
    if (blockchain.chain.length === 0) {
        blockchain.chain.push(Block.genesis);
    }

    const lastBlock = blockchain.getLastBlock();
    const height = lastBlock.height + 1; // La altura es el Id del bloque
    const previousHash = lastBlock.hash;

    let validator_selection;

    if (req.session.user.role === "student") {
        validator_selection = selectValidatorPoS();
    } else if (req.session.user.role === "university") {
        validator_selection = selectValidatorPoA();
    } else {
        return res.send("Rol no autorizado.");
    }

    const publicKey = validators[validator_selection].publicKey;

    // Se lee la clave privada desde la carpeta
    const privateKeyPath = path.join(keysDir, `${validator_selection}_private.pem`);
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const data = { certificateId: height, studentName, courseName };

    // Se obtiene la hora desde un servidor de tiempo
    let time;
    try {
        const response = await fetch('http://worldclockapi.com/api/json/utc/now');
        const timeData = await response.json();
        time = new Date(timeData.currentDateTime).getTime();
    } catch (error) {
        console.error('Error obteniendo el tiempo:', error);
        time = Date.now(); // Fallback al tiempo local
    }

    // Se firma la transacción (certificado)
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(data));
    sign.end();
    const signature = sign.sign(privateKey, 'base64');

    const tempBlock = new Block();
    const hash = tempBlock.calculateHash(height, previousHash, time, data, validator_selection);

    const newBlock = new Block(height, previousHash, time, { ...data, signature, publicKey }, hash, validator_selection);

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
    const blockHeight = parseInt(req.body.certificateId); // Id a número
    const found = blockchain.chain.find(block => block.height === blockHeight);

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
