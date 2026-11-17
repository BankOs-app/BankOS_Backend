import { GlobalHttpExceptionFilter } from './global-exception.filter';
import { BadRequestException, NotFoundException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

describe('GlobalHttpExceptionFilter', () => {
  let filter: GlobalHttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalHttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = {
      url: '/api/v1/tenants/banco-bogota/transactions/deposits',
      method: 'POST',
      headers: { 'x-correlation-id': 'corr-uuid-1234' },
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('debe estructurar los errores con código interno y descripción', () => {
    const exception = new BadRequestException('Monto de saldo insuficiente para transferir');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        internalCode: 'BANKOS_INSUFFICIENT_FUNDS',
        description: 'Monto de saldo insuficiente para transferir',
        correlationId: 'corr-uuid-1234',
        path: '/api/v1/tenants/banco-bogota/transactions/deposits',
      }),
    );
  });

  it('debe mapear NotFoundException correctamente a BANKOS_NOT_FOUND', () => {
    const exception = new NotFoundException('Cuenta no encontrada');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.NOT_FOUND,
        internalCode: 'BANKOS_NOT_FOUND',
        description: 'Cuenta no encontrada',
      }),
    );
  });

  it('debe manejar errores no controlados como 500 y BANKOS_INTERNAL_ERROR', () => {
    const exception = new Error('Database connection failed');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        internalCode: 'BANKOS_INTERNAL_ERROR',
        description: 'Database connection failed',
      }),
    );
  });
});
