import { ApiProperty } from '@nestjs/swagger';
import { TransactionItemDto } from './transaction-item.dto';

export class PaginatedTransactionsResponseDto {
  @ApiProperty({
    type: [TransactionItemDto],
    description: 'Lista de transacciones correspondientes a la página consultada',
  })
  data: TransactionItemDto[];

  @ApiProperty({
    description: 'Total de registros que coinciden con los criterios de búsqueda',
    example: 42,
  })
  total: number;

  @ApiProperty({
    description: 'Número de página actual consultada',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Límite de elementos solicitados por página',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Número total de páginas disponibles',
    example: 5,
  })
  totalPages: number;
}

