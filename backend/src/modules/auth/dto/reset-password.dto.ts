import { IsString, IsEmail, MinLength, Matches } from 'class-validator';

export class ResetPasswordRequestDto {
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: '비밀번호 형식이 올바르지 않습니다.',
  })
  new_password: string;
}
