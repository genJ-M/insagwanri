import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In } from 'typeorm';
import { Team } from '../../database/entities/team.entity';
import { TeamMember } from '../../database/entities/team-member.entity';
import { User } from '../../database/entities/user.entity';
import { Channel, ChannelType } from '../../database/entities/channel.entity';
import { ChannelMember } from '../../database/entities/channel-member.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateTeamDto, UpdateTeamDto,
  AddTeamMemberDto, SetTeamLeaderDto,
} from './dto/teams.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,

    @InjectRepository(TeamMember)
    private memberRepo: Repository<TeamMember>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    private dataSource: DataSource,
    private notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────
  // 팀 목록
  // ─────────────────────────────────────────

  /** 회사 내 전체 팀 목록 (멤버 수 포함) */
  async getTeams(currentUser: AuthenticatedUser) {
    const teams = await this.teamRepo.find({
      where: { companyId: currentUser.companyId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
      withDeleted: false,
    });

    const result = await Promise.all(
      teams.map(async (team) => {
        const memberCount = await this.memberRepo.count({
          where: { teamId: team.id },
        });
        const leader = team.leaderId
          ? await this.userRepo.findOne({
              where: { id: team.leaderId },
              select: ['id', 'name', 'profileImageUrl', 'department'],
            })
          : null;
        return { ...team, memberCount, leader };
      }),
    );

    return result;
  }

  /** 내가 속한 팀 목록 */
  async getMyTeams(currentUser: AuthenticatedUser) {
    const memberships = await this.memberRepo.find({
      where: { userId: currentUser.id },
      relations: ['team'],
    });

    return memberships
      .filter((m) => m.team && !m.team.deletedAt)
      .map((m) => ({
        ...m.team,
        membershipType: m.membershipType,
        joinedAt: m.joinedAt,
      }));
  }

  // ─────────────────────────────────────────
  // 팀 CRUD
  // ─────────────────────────────────────────

  async createTeam(currentUser: AuthenticatedUser, dto: CreateTeamDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('팀 생성 권한이 없습니다.');
    }

    // 같은 회사 내 팀명 중복 체크
    const exists = await this.teamRepo.findOne({
      where: { companyId: currentUser.companyId, name: dto.name, deletedAt: IsNull() },
      withDeleted: false,
    });
    if (exists) {
      throw new ConflictException('이미 같은 이름의 팀이 있습니다.');
    }

    // leaderId가 있는 경우 같은 회사 직원인지 검증
    if (dto.leaderId) {
      await this.assertUserInCompany(dto.leaderId, currentUser.companyId);
    }

    return this.dataSource.transaction(async (em) => {
      // 1. 팀 생성
      const team = em.create(Team, {
        companyId: currentUser.companyId,
        name: dto.name,
        description: dto.description ?? null,
        color: dto.color ?? null,
        leaderId: dto.leaderId ?? null,
      });
      await em.save(team);

      // 2. 팀 전용 채널 생성
      const channel = em.create(Channel, {
        companyId: currentUser.companyId,
        name: dto.name,
        type: ChannelType.TEAM,
        isPrivate: false,
        creatorId: currentUser.id,
        teamId: team.id,
      });
      await em.save(channel);

      // 3. 채널 ID를 팀에 저장
      team.channelId = channel.id;
      await em.save(team);

      // 4. 팀 생성자를 첫 번째 팀원으로 추가
      const creatorMember = em.create(TeamMember, {
        teamId: team.id,
        userId: currentUser.id,
        membershipType: 'primary',
      });
      await em.save(creatorMember);
      await em.save(
        em.create(ChannelMember, { channelId: channel.id, userId: currentUser.id }),
      );

      // 5. 추가 팀원 등록
      const memberIds = (dto.memberIds ?? []).filter((id) => id !== currentUser.id);
      for (const userId of memberIds) {
        const userExists = await em.findOne(User, {
          where: { id: userId, companyId: currentUser.companyId },
        });
        if (!userExists) continue;

        await em.save(em.create(TeamMember, {
          teamId: team.id,
          userId,
          membershipType: 'primary',
        }));
        await em.save(em.create(ChannelMember, { channelId: channel.id, userId }));
      }

      return team;
    });
  }

  async getTeam(currentUser: AuthenticatedUser, teamId: string) {
    const team = await this.teamRepo.findOne({
      where: { id: teamId, companyId: currentUser.companyId, deletedAt: IsNull() },
      withDeleted: false,
    });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');
    return team;
  }

  async updateTeam(currentUser: AuthenticatedUser, teamId: string, dto: UpdateTeamDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('팀 수정 권한이 없습니다.');
    }

    const team = await this.getTeam(currentUser, teamId);

    // 팀명 변경 시 중복 체크
    if (dto.name && dto.name !== team.name) {
      const exists = await this.teamRepo.findOne({
        where: { companyId: currentUser.companyId, name: dto.name, deletedAt: IsNull() },
        withDeleted: false,
      });
      if (exists) throw new ConflictException('이미 같은 이름의 팀이 있습니다.');
    }

    Object.assign(team, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.color !== undefined && { color: dto.color }),
    });
    await this.teamRepo.save(team);

    // 채널명도 동기화
    if (dto.name && team.channelId) {
      await this.dataSource.getRepository(Channel).update(team.channelId, { name: dto.name });
    }

    return team;
  }

  async deleteTeam(currentUser: AuthenticatedUser, teamId: string) {
    if (currentUser.role !== UserRole.OWNER) {
      throw new ForbiddenException('팀 삭제는 소유자만 가능합니다.');
    }

    const team = await this.getTeam(currentUser, teamId);

    await this.dataSource.transaction(async (em) => {
      // 채널 soft delete
      if (team.channelId) {
        await em.softDelete(Channel, { id: team.channelId });
      }
      // 팀원 전체 삭제
      await em.delete(TeamMember, { teamId: team.id });
      // 팀 soft delete
      await em.softDelete(Team, { id: team.id });
    });

    return { success: true };
  }

  // ─────────────────────────────────────────
  // 팀원 관리
  // ─────────────────────────────────────────

  async getTeamMembers(currentUser: AuthenticatedUser, teamId: string) {
    await this.getTeam(currentUser, teamId); // 회사 소속 확인

    const members = await this.memberRepo.find({
      where: { teamId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });

    return members.map((m) => ({
      userId: m.userId,
      membershipType: m.membershipType,
      joinedAt: m.joinedAt,
      user: m.user
        ? {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            department: m.user.department,
            position: m.user.position,
            role: m.user.role,
            profileImageUrl: m.user.profileImageUrl,
          }
        : null,
    }));
  }

  async addTeamMember(currentUser: AuthenticatedUser, teamId: string, dto: AddTeamMemberDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('팀원 추가 권한이 없습니다.');
    }

    const team = await this.getTeam(currentUser, teamId);
    await this.assertUserInCompany(dto.userId, currentUser.companyId);

    // 이미 멤버인지 확인
    const existing = await this.memberRepo.findOne({
      where: { teamId, userId: dto.userId },
    });
    if (existing) throw new ConflictException('이미 팀 멤버입니다.');

    await this.dataSource.transaction(async (em) => {
      await em.save(
        em.create(TeamMember, {
          teamId,
          userId: dto.userId,
          membershipType: dto.membershipType ?? 'primary',
        }),
      );

      // 채널 멤버 추가
      if (team.channelId) {
        const alreadyInChannel = await em.findOne(ChannelMember, {
          where: { channelId: team.channelId, userId: dto.userId },
        });
        if (!alreadyInChannel) {
          await em.save(
            em.create(ChannelMember, { channelId: team.channelId, userId: dto.userId }),
          );
        }
      }
    });

    // 알림 발송 (추가된 팀원에게)
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (user) {
      await this.notificationsService.dispatch({
        userId: dto.userId,
        companyId: currentUser.companyId,
        type: 'team_member_added',
        title: '팀에 추가되었습니다',
        body: `${team.name} 팀에 추가되었습니다.`,
      });
    }

    return { success: true };
  }

  async removeTeamMember(currentUser: AuthenticatedUser, teamId: string, userId: string) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('팀원 제거 권한이 없습니다.');
    }

    const team = await this.getTeam(currentUser, teamId);

    const member = await this.memberRepo.findOne({ where: { teamId, userId } });
    if (!member) throw new NotFoundException('팀 멤버를 찾을 수 없습니다.');

    // 팀장을 제거하려는 경우 팀장 해제
    if (team.leaderId === userId) {
      await this.teamRepo.update(teamId, { leaderId: null });
    }

    await this.dataSource.transaction(async (em) => {
      await em.delete(TeamMember, { teamId, userId });
      // 채널 멤버 제거
      if (team.channelId) {
        await em.delete(ChannelMember, { channelId: team.channelId, userId });
      }
    });

    return { success: true };
  }

  // ─────────────────────────────────────────
  // 팀장 지정
  // ─────────────────────────────────────────

  async setTeamLeader(currentUser: AuthenticatedUser, teamId: string, dto: SetTeamLeaderDto) {
    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('팀장 지정 권한이 없습니다.');
    }

    const team = await this.getTeam(currentUser, teamId);

    // 지정할 사용자가 팀 멤버인지 확인
    const member = await this.memberRepo.findOne({
      where: { teamId, userId: dto.userId },
    });
    if (!member) throw new BadRequestException('팀 멤버만 팀장으로 지정할 수 있습니다.');

    const prevLeaderId = team.leaderId;
    await this.teamRepo.update(teamId, { leaderId: dto.userId });

    // 새 팀장에게 알림
    if (dto.userId !== prevLeaderId) {
      await this.notificationsService.dispatch({
        userId: dto.userId,
        companyId: currentUser.companyId,
        type: 'team_leader_assigned',
        title: '팀장으로 지정되었습니다',
        body: `${team.name} 팀의 팀장으로 지정되었습니다.`,
      });
    }

    return { success: true };
  }

  // ─────────────────────────────────────────
  // 팀장 권한 헬퍼 (다른 모듈에서 사용)
  // ─────────────────────────────────────────

  /**
   * 팀장인 경우 해당 팀의 팀원 userId 목록 반환.
   * 팀장이 아니거나 팀원이 없으면 null 반환.
   */
  async getLeaderTeamMemberIds(userId: string, companyId: string): Promise<string[] | null> {
    const ledTeams = await this.teamRepo.find({
      where: { leaderId: userId, companyId, deletedAt: IsNull() },
      select: ['id'],
      withDeleted: false,
    });
    if (!ledTeams.length) return null;

    const members = await this.memberRepo.find({
      where: { teamId: In(ledTeams.map((t) => t.id)) },
      select: ['userId'],
    });

    const ids = [...new Set(members.map((m) => m.userId))];
    return ids.length ? ids : null;
  }

  /**
   * 특정 userId가 내 팀원인지 확인 (팀장 권한 검증용)
   */
  async isLeaderOf(leaderId: string, memberId: string, companyId: string): Promise<boolean> {
    const memberIds = await this.getLeaderTeamMemberIds(leaderId, companyId);
    return memberIds?.includes(memberId) ?? false;
  }

  // ─────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────

  private async assertUserInCompany(userId: string, companyId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundException(`직원을 찾을 수 없습니다.`);
    return user;
  }
}
