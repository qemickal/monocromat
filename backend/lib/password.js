const {scrypt: cb,randomBytes,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');const scrypt=promisify(cb);
const opt={N:32768,r:8,p:1,maxmem:64*1024*1024};
async function hashPassword(pass){if(typeof pass!=='string'||pass.length<12||Buffer.byteLength(pass)>1024)throw Error('La contraseña debe tener al menos 12 caracteres.');const salt=randomBytes(16);const key=await scrypt(pass,salt,32,opt);return `scrypt-v1:${salt.toString('hex')}:${key.toString('hex')}`}
async function verifyPassword(pass,stored){if(typeof pass!=='string'||Buffer.byteLength(pass)>1024||typeof stored!=='string')return false;const [v,s,k,...rest]=stored.split(':');if(v!=='scrypt-v1'||rest.length||!/^[0-9a-f]{32}$/.test(s||'')||!/^[0-9a-f]{64}$/.test(k||''))return false;let expected=Buffer.from(k,'hex');let actual=await scrypt(pass,Buffer.from(s,'hex'),32,opt);return timingSafeEqual(expected,actual)}
module.exports={hashPassword,verifyPassword};
