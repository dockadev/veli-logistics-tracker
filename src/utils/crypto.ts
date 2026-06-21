// DOCKA Cryptographic Utility - AES-256 Database Encryption using CryptoJS
// Ensures full support across secure and insecure browser contexts.

import CryptoJS from 'crypto-js';

export interface EncryptedPayload {
    ciphertext: string;
    iv: string;
    salt: string;
}

// Derive a cryptographic key from a raw password string using PBKDF2
function deriveKey(password: string, salt: CryptoJS.lib.WordArray, iterations: number = 100000): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(password, salt, {
        keySize: 256 / 32,
        iterations: iterations,
        hasher: CryptoJS.algo.SHA256
    });
}

// Encrypt string data using a password
export async function encryptWithPassword(data: string, password: string, iterations: number = 100000): Promise<EncryptedPayload> {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const key = deriveKey(password, salt, iterations);
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

// Decrypt ciphertext using a password with fallback support
export async function decryptWithPassword(payload: EncryptedPayload, password: string, iterations: number = 100000): Promise<string> {
    try {
        const salt = CryptoJS.enc.Base64.parse(payload.salt);
        const iv = CryptoJS.enc.Base64.parse(payload.iv);
        const key = deriveKey(password, salt, iterations);

        const decrypted = CryptoJS.AES.decrypt(payload.ciphertext, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const plainText = decrypted.toString(CryptoJS.enc.Utf8);
        if (plainText) {
            return plainText;
        }
    } catch {
        // Fallback below
    }

    // Adaptive fallback if custom iterations (e.g. 1) failed, try full key stretching
    if (iterations !== 100000) {
        try {
            const salt = CryptoJS.enc.Base64.parse(payload.salt);
            const iv = CryptoJS.enc.Base64.parse(payload.iv);
            const key = deriveKey(password, salt, 100000);

            const decrypted = CryptoJS.AES.decrypt(payload.ciphertext, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

            const plainText = decrypted.toString(CryptoJS.enc.Utf8);
            if (plainText) {
                return plainText;
            }
        } catch {
            // Let final throw handle it
        }
    }

    throw new Error('Decryption failed: empty plaintext or incorrect password');
}

// Generates a new random Master Key as Base64
export function generateRandomMasterKey(): string {
    return CryptoJS.lib.WordArray.random(256 / 8).toString(CryptoJS.enc.Base64);
}

