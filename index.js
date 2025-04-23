const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Blockchain = require("./src/blockchain");
const Block = require("./src/block");
const MerkleTree = require("./src/merkle");
const ntpClient = require('ntp-client'); 

const app = express();
const port = 3000;

let blockchain = new Blockchain();
const users = {};
const validators = {};

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

let poaIndex = 0;

// Registro de usuarios y generación de claves RSA
async function registerUser(username, password, role) {
    if (users[username]) return false;

    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = { password: hashedPassword, role };

    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    // Guardado de clave
    fs.writeFileSync(path.join(keysDir, `${username}_private.pem`), privateKey);

    // Se almacena únicamente la clave pública en memoria
    validators[username] = { publicKey };

    blockchain.validators.add(username);

    return true;
}

// Obtención de validadores excluyendo al usuario actual
function getAvailableValidators(role, username) {
    return Object.keys(users)
        .filter(user => users[user].role === role && user !== username);
}

// Selección de validador en PoS
function selectValidatorPoS(username) {
    const posValidators = getAvailableValidators("student", username);
    if (posValidators.length === 0) return null;
    return posValidators[Math.floor(Math.random() * posValidators.length)];
}

// Función de selección de validador en PoA con rotación automática
function selectValidatorPoA(username) {
    const poaValidators = getAvailableValidators("university", username);
    if (poaValidators.length === 0) return null;
    const validator = poaValidators[poaIndex]; // Obtención del validador actual
    poaIndex = (poaIndex + 1) % poaValidators.length; // Rotación de validador
    return validator;
}

// Función para crear el árbol de merkle usando archivos creados en la carpeta files
function getMerkleRootFromFiles() {
    const filesDir = path.join(__dirname, 'files');
    if (!fs.existsSync(filesDir)) return '';

    const files = fs.readdirSync(filesDir);
    if (files.length === 0) return '';

    const fileHashes = files.map(file => {
        const filePath = path.join(filesDir, file);
        const fileData = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileData).digest('hex');
    });

    const merkleTree = new MerkleTree(fileHashes);
    return merkleTree.root;
}

// Rutas de autenticación
app.get('/register', (req, res) => res.render('register'));
app.get('/login', (req, res) => res.render('login'));

app.post("/register", async (req, res) => {
    const { username, password, role } = req.body;

    if (await registerUser(username, password, role)) {
        res.redirect("/login");
    } else {
        res.send("Usuario ya registrado.");
    }
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
    const { username, role } = req.session.user;

    const availableValidators = getAvailableValidators(role, username);

    if (availableValidators.length < 1) {
        return res.send("Error: No hay suficientes validadores disponibles.");
    }

    const lastBlock = blockchain.getLastBlock();
    const height = lastBlock.height + 1; // La altura es el Id del bloque
    const previousHash = lastBlock.hash;
    const merkleRoot = getMerkleRootFromFiles();

    let validator_selection;

    if (req.session.user.role === "student") {
        validator_selection = selectValidatorPoS(username);
    } else if (req.session.user.role === "university") {
        validator_selection = selectValidatorPoA(username);
    } else {
        return res.send("Rol no autorizado.");
    }

    if (!validator_selection) {
        return res.send("Error: No hay suficientes validadores disponibles.");
    }

    if (!validators[validator_selection]) {
        return res.send("Error: El validador seleccionado no tiene clave pública registrada.");
    }

    const publicKey = validators[validator_selection].publicKey;

    // Se lee la clave privada desde la carpeta
    const privateKeyPath = path.join(keysDir, `${validator_selection}_private.pem`);

    if (!fs.existsSync(privateKeyPath)) {
        return res.send("Error: No se encontró la clave privada del validador.");
    }

    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    const data = { certificateId: height, studentName, courseName };

    let time;
    try {
        const ntpResult = await new Promise((resolve, reject) => {
            ntpClient.getNetworkTime("pool.ntp.org", 123, (err, time) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ getTime: () => time.getTime(), raw: time }); // Adaptamos el resultado
            });
        });
        time = ntpResult.getTime();
        console.log('Hora obtenida de NTP:', new Date(time).toISOString());
    } catch (error) {
        console.error('Error obteniendo el tiempo de NTP:', error);
        time = Date.now(); // Fallback al tiempo local
        console.warn('Usando la hora del sistema local como respaldo.');
    }

    // Se firma la transacción
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(data));
    sign.end();
    const signature = sign.sign(privateKey, 'base64');

    const hash = Block.calculateHash(height, previousHash, time, { studentName, courseName }, validator_selection, merkleRoot);

    const newBlock = new Block(height, previousHash, time, { ...data, signature, publicKey }, hash, validator_selection, merkleRoot);

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