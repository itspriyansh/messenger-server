const BigInt = require("big-integer");

const base = 128;
const Limit = 128;
const noOfProbabilityTests = 60;
let set = '';

for(let i=0;i<base;i++){
	set += String.fromCharCode(i);
}

const RandomBig = () => {
	let random = new BigInt(String.fromCharCode(0), base, set, true);
	random = random.add(Math.floor(Math.random()*1000)%256);
	for(let i=1;i<Limit;i++){
		random = random.multiply(base).add(Math.floor(Math.random()*1000)%256);
	}
	return random;
};

const GeneratePrime = () => {
	let prime = RandomBig();
	for(let i=0;i<354;i++){
		if(prime.isDivisibleBy(2)){
			prime = prime.add(1);
		}
		if(prime.isProbablePrime(noOfProbabilityTests)){
			break;
		}else{
			prime = prime.add(2);
		}
	}
	return prime;
};

exports.RsaKeyGeneration = () => {
	let p = GeneratePrime();
	let q = GeneratePrime();
	let n = p.multiply(q);
	let phi = p.minus(1).multiply(q.minus(1));
	let e = RandomBig().mod(phi.subtract(1)).add(1);
	while(BigInt.gcd(e, phi)!=1){
		e = e.add(1);
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