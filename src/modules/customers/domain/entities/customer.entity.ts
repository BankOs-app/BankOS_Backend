import { randomUUID } from 'node:crypto';

export interface CustomerProps {
  id: string;
  tenantId: string;
  userId: string;
  fullName: string;
  documentNumber: string;
  email: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio: Ficha de Cliente Bancario.
 *
 * En BankOS, cada cliente pertenece a un único tenant y está vinculado
 * a un usuario con rol 'customer'.
 */
export class Customer {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly userId: string;
  private fullName: string;
  private readonly documentNumber: string;
  private email: string;
  private phone?: string;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: CustomerProps) {
    this.validate(props);
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.fullName = props.fullName.trim();
    this.documentNumber = props.documentNumber.trim();
    this.email = props.email.trim().toLowerCase();
    this.phone = props.phone?.trim();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(params: {
    tenantId: string;
    userId: string;
    fullName: string;
    documentNumber: string;
    email: string;
    phone?: string;
  }): Customer {
    const now = new Date();
    return new Customer({
      id: randomUUID(),
      tenantId: params.tenantId,
      userId: params.userId,
      fullName: params.fullName,
      documentNumber: params.documentNumber,
      email: params.email,
      phone: params.phone,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  public updateProfile(fullName: string, email: string, phone?: string): void {
    if (!fullName || fullName.trim().length < 3) {
      throw new Error('El nombre completo debe tener al menos 3 caracteres.');
    }
    if (!email || !email.includes('@')) {
      throw new Error('El email no es válido.');
    }
    this.fullName = fullName.trim();
    this.email = email.trim().toLowerCase();
    this.phone = phone?.trim();
    this.updatedAt = new Date();
  }

  private validate(props: CustomerProps): void {
    if (!props.tenantId) {
      throw new Error('El tenantId es obligatorio para el cliente.');
    }
    if (!props.userId) {
      throw new Error('El userId vinculado es obligatorio.');
    }
    if (!props.fullName || props.fullName.trim().length < 3) {
      throw new Error('El nombre del cliente debe tener al menos 3 caracteres.');
    }
    if (!props.documentNumber || props.documentNumber.trim().length < 5) {
      throw new Error('El documento de identidad debe tener al menos 5 caracteres.');
    }
    if (!props.email || !props.email.includes('@')) {
      throw new Error('El email del cliente no es válido.');
    }
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getFullName(): string {
    return this.fullName;
  }

  public getDocumentNumber(): string {
    return this.documentNumber;
  }

  public getEmail(): string {
    return this.email;
  }

  public getPhone(): string | undefined {
    return this.phone;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

