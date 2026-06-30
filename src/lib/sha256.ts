// SHA-256 hex, used to hash contact identifiers before they leave the device. expo-crypto is
// loaded lazily through require so type-checking and tests never depend on the native module
// being present (the real module is bundled into the native build).
export async function sha256Hex(value: string): Promise<string> {
  const Crypto = require("expo-crypto");
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}
