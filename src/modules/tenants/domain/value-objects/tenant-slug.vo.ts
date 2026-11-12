/**
 * Value Object (Objeto de Valor) que encapsula las reglas de formato de un Slug.
 * 
 * En Domain-Driven Design (DDD), un Value Object es inmutable y garantiza
 * que ningún dato inválido pueda existir en el dominio.
 */
export class TenantSlug {
  // Expresión regular que admite letras minúsculas, números y guiones sencillos
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  private readonly value: string;

  constructor(rawSlug: string) {
    if (!rawSlug || typeof rawSlug !== 'string') {
      throw new Error('El slug del tenant no puede estar vacío');
    }

    const normalized = rawSlug.trim().toLowerCase();

    if (normalized.length < 3 || normalized.length > 50) {
      throw new Error('El slug debe tener entre 3 y 50 caracteres');
    }

    if (!TenantSlug.SLUG_REGEX.test(normalized)) {
      throw new Error(
        'El slug solo puede contener letras minúsculas, números y guiones simples (sin guiones consecutivos o al inicio/final)',
      );
    }

    this.value = normalized;
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: TenantSlug): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}

