import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, AuthenticatedUser } from '../../common/types/jwt-payload.type';
import { CreateLocationDto, UpdateLocationDto, AssignEmployeeDto } from './dto/locations.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly svc: LocationsService) {}

  /**
   * GET /api/v1/locations
   * 지점 목록 + 한도 정보 (owner/manager)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get()
  async getLocations(@GetUser() user: AuthenticatedUser) {
    const data = await this.svc.getLocations(user);
    return { success: true, data };
  }

  /**
   * GET /api/v1/locations/me
   * 내 배정 지점 (전 직원)
   */
  @Get('me')
  async getMyLocations(@GetUser() user: AuthenticatedUser) {
    const data = await this.svc.getMyLocations(user);
    return { success: true, data };
  }

  /**
   * POST /api/v1/locations
   * 지점 생성 (owner only)
   */
  @Roles(UserRole.OWNER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createLocation(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: CreateLocationDto,
  ) {
    const data = await this.svc.createLocation(user, dto);
    return { success: true, data };
  }

  /**
   * PATCH /api/v1/locations/:id
   * 지점 수정 (owner only)
   */
  @Roles(UserRole.OWNER)
  @Patch(':id')
  async updateLocation(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const data = await this.svc.updateLocation(user, id, dto);
    return { success: true, data };
  }

  /**
   * DELETE /api/v1/locations/:id
   * 지점 삭제 (soft delete, owner only)
   */
  @Roles(UserRole.OWNER)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteLocation(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.svc.deleteLocation(user, id);
    return { success: true, data };
  }

  /**
   * GET /api/v1/locations/:id/employees
   * 지점 소속 직원 목록 (owner/manager)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get(':id/employees')
  async getLocationEmployees(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.svc.getLocationEmployees(user, id);
    return { success: true, data };
  }

  /**
   * POST /api/v1/locations/:id/employees
   * 직원 지점 배정 (owner/manager)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post(':id/employees')
  @HttpCode(HttpStatus.OK)
  async assignEmployee(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignEmployeeDto,
  ) {
    const data = await this.svc.assignEmployee(user, id, dto);
    return { success: true, data };
  }

  /**
   * DELETE /api/v1/locations/:id/employees/:userId
   * 직원 지점 배정 해제 (owner/manager)
   */
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete(':id/employees/:userId')
  @HttpCode(HttpStatus.OK)
  async unassignEmployee(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const data = await this.svc.unassignEmployee(user, id, userId);
    return { success: true, data };
  }
}
