import { IsEmail, IsString, MinLength, Length } from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class AdminMfaVerifyDto {
  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  tempToken: string; // pre-MFA 임시 토큰
}

export class AdminMfaSetupInitDto {
  @IsString()
  tempToken: string; // 로그인 후 발급된 임시 토큰
}

export class AdminMfaSetupConfirmDto {
  @IsString()
  tempToken: string;

  @IsString()
  @Length(6, 6)
  code: string; // TOTP 코드로 설정 완료 확인
}
