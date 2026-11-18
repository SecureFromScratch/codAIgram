/** Generates a non-cryptographic UUID; it must never be used as a secret or access token. */
export function createNonCryptoGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character: string) => {
    const value: number = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
