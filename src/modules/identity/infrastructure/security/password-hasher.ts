import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Servicio criptográfico seguro para derivación y validación de contraseñas y PINs bancarios.
 *
 * Utiliza scrypt con salt aleatorio de 16 bytes y clave de 64 bytes, resistente a ataques
 * de diccionario, tablas arcoíris y ataques de sincronización (timing attacks).
 */
export class PasswordHasher {
  /**
   * Genera el hash seguro de un PIN o contraseña.
   * Formato de salida: `<salt_hex>:<hash_hex>`
   */
  public static hash(plain: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(plain.trim(), salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Compara de forma segura (tiempo constante) un texto plano contra el hash almacenado.
   */
  public static verify(plain: string, storedHash: string): boolean {
    if (!storedHash || !storedHash.includes(':')) {
      return false;
    }
    try {
      const [salt, key] = storedHash.split(':');
      const keyBuffer = Buffer.from(key, 'hex');
      const derivedKey = scryptSync(plain.trim(), salt, 64);
      return timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }
}
