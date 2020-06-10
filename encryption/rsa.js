const BigInt = require("big-integer");
const crypto = require('crypto');

const base = 256;
const Limit = 128;
let set = '';

for(let i=0;i<256;i++){
	set += String.fromCharCode(i);
}

const RandomBig = () => {
	let buffer = new Uint8Array(Limit);
	crypto.randomFillSync(buffer);
	let random = new BigInt(String.fromCharCode(0), base, set, true);
	for(let i=0;i<Limit;i++){
		random = random.multiply(base).add(buffer[i]);
	}
	return random;
};

const randomGenerator = () => {
	var randomBuffer = new Uint16Array(1);
	crypto.randomFillSync(randomBuffer);
	return randomBuffer[0];
};

const GeneratePrime = () => {
	const generator = randomGenerator();
	const prime = crypto.createDiffieHellman(Limit*8, generator).getPrime();
	let primeBigInt = new BigInt(String.fromCharCode(0), base, set, true);
	for(let i=0;i<Limit;i++){
		primeBigInt = primeBigInt.multiply(base).add(prime[i]);
	}
	return primeBigInt;
};

exports.RsaKeyGeneration = () => {
	let p = GeneratePrime();
	let q = GeneratePrime();
	let n = p.multiply(q);
	let phi = p.minus(1).multiply(q.minus(1));

	let e = RandomBig().mod(phi.subtract(1)).add(2);
	while(BigInt.gcd(e, phi)!=1){
		e = RandomBig().mod(phi.subtract(1)).add(2);
	}
	let d = e.modInv(phi);
	return ({public: e.toString(base, set), private: d.toString(base, set), n: n.toString(base, set)});
};

exports.Encryption = (num, obj) => {
	let x = BigInt(num, base, set, true);
	let publicKey = BigInt(obj.public, base, set, true);
	let n = BigInt(obj.n, base, set, true);
	let y = x.modPow(publicKey, n).toString(base, set);
	return y;
};

exports.Decryption = (num, obj) => {
	let y = BigInt(num, base, set, true);
	let privateKey = BigInt(obj.private, base, set, true);
	let n = BigInt(obj.n, base, set, true);
	let z = y.modPow(privateKey, n).toString(base, set);
	return z;
};