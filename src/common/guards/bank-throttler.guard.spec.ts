import { BankThrottlerGuard } from './bank-throttler.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('BankThrottlerGuard', () => {
  let guard: BankThrottlerGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    const storageService = {
      increment: jest.fn(),
    } as any;
    guard = new BankThrottlerGuard(
      { throttlers: [{ ttl: 60000, limit: 10 }] } as any,
      storageService,
      reflector,
    );
  });

  it('debe rastrear por IP si la petición no está autenticada', async () => {
    const req = {
      headers: { 'x-forwarded-for': '203.0.113.195' },
      ip: '127.0.0.1',
    };

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('ip:203.0.113.195');
  });

  it('debe rastrear por cuenta de usuario si está autenticado', async () => {
    const req = {
      user: {
        userId: 'usr-1234',
        tenantId: 'tnt-bogota',
      },
      ip: '203.0.113.195',
    };

    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('user:tnt-bogota:usr-1234');
  });

  it('debe retornar mensaje en español al exceder el límite', async () => {
    const errorMsg = await (guard as any).getErrorMessage({} as ExecutionContext, {} as any);
    expect(errorMsg).toContain('Límite de peticiones alcanzado');
  });
});

