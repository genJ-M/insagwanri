import { AdminRole } from '../../database/entities/admin-user.entity';

export interface AdminJwtPayload {
  sub: string;       // admin_user id
  email: string;
  role: AdminRole;
  mfaVerified: boolean;
}
