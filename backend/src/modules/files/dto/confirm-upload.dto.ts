import { IsUUID, IsIn, IsOptional } from 'class-validator';
import { FileRefType } from '../../../database/entities/file.entity';

export class ConfirmUploadDto {
  @IsUUID()
  fileId: string;

  @IsOptional()
  @IsIn(['task', 'message', 'report', 'user', 'company'])
  refType?: FileRefType;

  @IsOptional()
  @IsUUID()
  refId?: string;
}
