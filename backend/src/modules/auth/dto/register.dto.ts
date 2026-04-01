import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { CompanyType } from '../../../database/entities/company.entity';

export class RegisterDto {
  // 회사 정보
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  company_name: string;

  @IsOptional()
  @IsEnum(CompanyType)
  company_type?: CompanyType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{3}-\d{2}-\d{5}$/, {
    message: '사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)',
  })
  business_number?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}-\d{7}$/, {
    message: '법인등록번호 형식이 올바르지 않습니다. (예: 110111-1234567)',
  })
  corporate_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  representative_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  business_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  business_item?: string;

  // owner 계정 정보
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      '비밀번호는 대/소문자, 숫자, 특수문자(@$!%*?&)를 각각 1개 이상 포함해야 합니다.',
  })
  password: string;
}
