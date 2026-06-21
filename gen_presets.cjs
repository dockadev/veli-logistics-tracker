const CryptoJS = require('crypto-js');

async function encryptWithPassword(data, password) {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const key = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: 100000,
        hasher: CryptoJS.algo.SHA256
    });
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return {
        ciphertext: encrypted.toString(),
        iv: iv.toString(CryptoJS.enc.Base64),
        salt: salt.toString(CryptoJS.enc.Base64)
    };
}

async function decryptWithPassword(payload, password) {
    const salt = CryptoJS.enc.Base64.parse(payload.salt);
    const iv = CryptoJS.enc.Base64.parse(payload.iv);
    const key = CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: 100000,
        hasher: CryptoJS.algo.SHA256
    });
    const decrypted = CryptoJS.AES.decrypt(payload.ciphertext, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

async function run() {
    const officerPwd = "ParsOfficer2026";
    const memberPwd = "ParsMember2026";

    // 1. Generate new random Master Key
    const masterKey = CryptoJS.lib.WordArray.random(256 / 8).toString(CryptoJS.enc.Base64);

    // 2. Wrap Master Key with both passwords
    const wrappedOfficer = await encryptWithPassword(masterKey, officerPwd);
    const wrappedMember = await encryptWithPassword(masterKey, memberPwd);

    // 3. Encrypt verification string using the Master Key
    const verification = await encryptWithPassword('DOCKA-AUTH-VERIFY', masterKey);

    // Self Test
    console.log("Running self-test...");
    const decMasterOfficer = await decryptWithPassword(wrappedOfficer, officerPwd);
    console.log("Officer Decryption Match:", decMasterOfficer === masterKey);

    const decMasterMember = await decryptWithPassword(wrappedMember, memberPwd);
    console.log("Member Decryption Match:", decMasterMember === masterKey);

    const check = await decryptWithPassword(verification, masterKey);
    console.log("Verification Match:", check === 'DOCKA-AUTH-VERIFY');

    if (decMasterOfficer === masterKey && decMasterMember === masterKey && check === 'DOCKA-AUTH-VERIFY') {
        console.log("Self-test PASSED.");
    } else {
        console.error("Self-test FAILED!");
        process.exit(1);
    }

    console.log("\nGenerated Presets:");
    console.log(JSON.stringify({
        wrappedOfficer,
        wrappedMember,
        verification
    }, null, 2));
}

run().catch(console.error);
