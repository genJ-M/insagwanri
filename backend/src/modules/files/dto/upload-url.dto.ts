import { IsString, IsIn, IsNumber, IsPositive, IsNotEmpty } from 'class-validator';
import { FileFeature } from '../../../database/entities/file.entity';

export class UploadUrlDto {
  @IsIn(['profiles', 'logo', 'tasks', 'messages', 'reports'])
  feature: FileFeature;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsNumber()
  @IsPositive()
  fileSizeBytes: number;
}
