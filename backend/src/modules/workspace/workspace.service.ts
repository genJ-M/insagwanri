import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  UpdateWorkspaceDto, UpdateWorkSettingsDto, UpdateGpsSettingsDto, UpdateBrandingDto,
  UpdateAttendanceMethodsDto, UpdateItSettingsDto, UpdatePublicSectorSettingsDto,
  UpdateShiftWorkerSettingsDto, UpdatePartTimeSettingsDto, UpdateFieldVisitWorkspaceSettingsDto,
} from './dto/workspace.dto';
import { INDUSTRY_PRESETS } from './industry-presets.constant';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
  ) {}

  async getSettings(currentUser: AuthenticatedUser) {
    const company = await this.companyRepo.findOne({
      where: { id: currentUser.companyId },
    });
    if (!company) throw new NotFoundException('회사 정보를 찾을 수 없습니다.');
    return company;
  }

  async updateWorkspace(currentUser: AuthenticatedUser, dto: UpdateWorkspaceDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.name               && { name: dto.name }),
      ...(dto.companyType        !== undefined && { companyType: dto.companyType }),
      ...(dto.businessNumber     !== undefined && { businessNumber: dto.businessNumber }),
      ...(dto.corporateNumber    !== undefined && { corporateNumber: dto.corporateNumber }),
      ...(dto.representativeName !== undefined && { representativeName: dto.representativeName }),
      ...(dto.businessType       !== undefined && { businessType: dto.businessType }),
      ...(dto.businessItem       !== undefined && { businessItem: dto.businessItem }),
      ...(dto.industry           !== undefined && { industry: dto.industry }),
      ...(dto.phone              !== undefined && { phone: dto.phone }),
      ...(dto.address            !== undefined && { address: dto.address }),
      ...(dto.logoUrl            !== undefined && { logoUrl: dto.logoUrl }),
    });
    return this.getSettings(currentUser);
  }

  async updateWorkSettings(currentUser: AuthenticatedUser, dto: UpdateWorkSettingsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.workStartTime    !== undefined && { workStartTime: dto.workStartTime }),
      ...(dto.workEndTime      !== undefined && { workEndTime: dto.workEndTime }),
      ...(dto.lateThresholdMin !== undefined && { lateThresholdMin: dto.lateThresholdMin }),
      ...(dto.workDays         !== undefined && { workDays: dto.workDays }),
    });
    return this.getSettings(currentUser);
  }

  async updateGpsSettings(currentUser: AuthenticatedUser, dto: UpdateGpsSettingsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      gpsEnabled:    dto.gpsEnabled,
      ...(dto.gpsLat       !== undefined && { gpsLat: dto.gpsLat }),
      ...(dto.gpsLng       !== undefined && { gpsLng: dto.gpsLng }),
      ...(dto.gpsRadiusM   !== undefined && { gpsRadiusM: dto.gpsRadiusM }),
      ...(dto.gpsStrictMode !== undefined && { gpsStrictMode: dto.gpsStrictMode }),
    });
    return this.getSettings(currentUser);
  }

  async updateBranding(currentUser: AuthenticatedUser, dto: UpdateBrandingDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.coverImageUrl !== undefined       && { coverImageUrl: dto.coverImageUrl }),
      ...(dto.coverImageMobileUrl !== undefined && { coverImageMobileUrl: dto.coverImageMobileUrl }),
      ...(dto.coverMobileCrop !== undefined     && { coverMobileCrop: dto.coverMobileCrop }),
      ...(dto.brandingTextColor                 && { brandingTextColor: dto.brandingTextColor }),
    });
    return this.getSettings(currentUser);
  }

  async updateAttendanceMethods(currentUser: AuthenticatedUser, dto: UpdateAttendanceMethodsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      attendanceMethods: {
        enabled: dto.enabled,
        ...(dto.wifi && { wifi: { ssids: dto.wifi.ssids } }),
        ...(dto.qr   && { qr: { windowMinutes: dto.qr.windowMinutes ?? 5 } }),
      },
    });
    return this.getSettings(currentUser);
  }

  async updateItSettings(currentUser: AuthenticatedUser, dto: UpdateItSettingsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.lateNightExemptionEnabled !== undefined && { lateNightExemptionEnabled: dto.lateNightExemptionEnabled }),
      ...(dto.lateNightThresholdHour    !== undefined && { lateNightThresholdHour:    dto.lateNightThresholdHour }),
      ...(dto.lateNightGraceMinutes     !== undefined && { lateNightGraceMinutes:     dto.lateNightGraceMinutes }),
      ...(dto.overtimeApprovalRequired  !== undefined && { overtimeApprovalRequired:  dto.overtimeApprovalRequired }),
    });
    return this.getSettings(currentUser);
  }

  async updatePublicSectorSettings(currentUser: AuthenticatedUser, dto: UpdatePublicSectorSettingsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.flexWorkEnabled           !== undefined && { flexWorkEnabled:           dto.flexWorkEnabled }),
      ...(dto.annualLeaveForceEnabled   !== undefined && { annualLeaveForceEnabled:   dto.annualLeaveForceEnabled }),
      ...(dto.annualLeaveForceThreshold !== undefined && { annualLeaveForceThreshold: dto.annualLeaveForceThreshold }),
    });
    return this.getSettings(currentUser);
  }

  async updateShiftWorkerSettings(currentUser: AuthenticatedUser, dto: UpdateShiftWorkerSettingsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.shiftLongWorkThresholdHours !== undefined && { shiftLongWorkThresholdHours: dto.shiftLongWorkThresholdHours }),
      ...(dto.nightWorkStartHour          !== undefined && { nightWorkStartHour:          dto.nightWorkStartHour }),
      ...(dto.nightWorkEndHour            !== undefined && { nightWorkEndHour:            dto.nightWorkEndHour }),
      ...(dto.nightPayRate                !== undefined && { nightPayRate:                dto.nightPayRate }),
    });
    return this.getSettings(currentUser);
  }

  async updatePartTimeSettings(currentUser: AuthenticatedUser, dto: UpdatePartTimeSettingsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.partTimeRoundingUnit   !== undefined && { partTimeRoundingUnit:   dto.partTimeRoundingUnit }),
      ...(dto.partTimeRoundingPolicy !== undefined && { partTimeRoundingPolicy: dto.partTimeRoundingPolicy }),
      ...(dto.partTimeDeductionUnit  !== undefined && { partTimeDeductionUnit:  dto.partTimeDeductionUnit }),
      ...(dto.workConfirmSmsEnabled  !== undefined && { workConfirmSmsEnabled:  dto.workConfirmSmsEnabled }),
    });
    return this.getSettings(currentUser);
  }

  async updateFieldVisitSettings(currentUser: AuthenticatedUser, dto: UpdateFieldVisitWorkspaceSettingsDto) {
    this.requireOwner(currentUser);
    await this.companyRepo.update(currentUser.companyId, {
      ...(dto.fieldVisitAutoTask  !== undefined && { fieldVisitAutoTask:  dto.fieldVisitAutoTask }),
      ...(dto.fieldVisitTaskTitle !== undefined && { fieldVisitTaskTitle: dto.fieldVisitTaskTitle }),
    });
    return this.getSettings(currentUser);
  }

  getIndustryPresets() {
    return INDUSTRY_PRESETS;
  }

  private requireOwner(user: AuthenticatedUser) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('owner만 회사 설정을 변경할 수 있습니다.');
    }
  }
}
