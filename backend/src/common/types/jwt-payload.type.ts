export enum UserRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

export interface JwtPayload {
  sub: string;        // user id
  companyId: string;  // 멀티테넌트 격리 핵심
  role: UserRole;
  email: string;
}

export interface JwtRefreshPayload extends JwtPayload {
  refreshTokenId: string; // refresh token 고유 식별자 (무효화용)
}

// 인증된 요청에 주입되는 사용자 객체
export interface AuthenticatedUser {
  id: string;
  companyId: string;
  role: UserRole;
  email: string;
  name: string;
}
