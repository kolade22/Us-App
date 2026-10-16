// RFC-4122-shaped v4 UUID for client-generated ids (message dedup keys,
// storage object names). Math.random-based: adequate as a client-side
// collision key, not for secrets. Replace with expo-crypto's randomUUID if
// stronger entropy is ever required.
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
