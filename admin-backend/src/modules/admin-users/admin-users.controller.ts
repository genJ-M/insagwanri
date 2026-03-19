import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../../database/entities/admin-user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUser as AdminUserDecorator } from '../../common/decorators/admin-user.decorator';
import { AdminJwtPayload } from '../../common/types/admin-jwt-payload.type';
import { IsEmail, IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ForbiddenException, ConflictException } from '@nestjs/common';

class CreateAdminUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() name: string;
  @IsEnum(AdminRole) role: AdminRole;
}

class UpdateAdminUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @IsOptional() isActive?: boolean;
}

@Controller('admin/v1/admin-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN) // 운영자 계정 관리는 SUPER_ADMIN 전용
export class AdminUsersController {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
  ) {}

  // GET /admin/v1/admin-users
  @Get()
  findAll() {
    return this.adminUserRepository.find({
      select: ['id', 'email', 'name', 'role', 'isActive', 'lastLoginAt', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  // POST /admin/v1/admin-users
  @Post()
  async create(@Body() dto: CreateAdminUserDto) {
    const exists = await this.adminUserRepository.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('이미 사용 중인 이메일입니다.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.adminUserRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
    });

    const saved = await this.adminUserRepository.save(user);
    const { passwordHash: _, ...result } = saved;
    return result;
  }

  // PATCH /admin/v1/admin-users/:id
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
    @AdminUserDecorator() actor: AdminJwtPayload,
  ) {
    // 자신의 역할 변경 금지
    if (id === actor.sub && dto.role) {
      throw new ForbiddenException('자신의 역할은 변경할 수 없습니다.');
    }

    await this.adminUserRepository.update(id, dto as any);
    return this.adminUserRepository.findOne({
      where: { id },
      select: ['id', 'email', 'name', 'role', 'isActive', 'lastLoginAt'],
    });
  }

  // DELETE /admin/v1/admin-users/:id (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AdminUserDecorator() actor: AdminJwtPayload,
  ) {
    if (id === actor.sub) {
      throw new ForbiddenException('자신의 계정은 삭제할 수 없습니다.');
    }
    await this.adminUserRepository.softDelete(id);
  }
}
