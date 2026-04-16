import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, IsNull } from 'typeorm';
import {
  ShiftSwapRequest, SwapType, SwapStatus,
} from '../../database/entities/shift-swap-request.entity';
import { ShiftAssignment } from '../../database/entities/shift-schedule.entity';
import { User } from '../../database/entities/user.entity';
import { AuthenticatedUser, UserRole } from '../../common/types/jwt-payload.type';
import {
  CreateSwapRequestDto, PeerRespondDto, ApproveRejectDto, SwapQueryDto, VolunteerDto,
} from './dto/shift-swap.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ShiftSwapService {
  constructor(
    @InjectRepository(ShiftSwapRequest)
    private swapRepo: Repository<ShiftSwapRequest>,
    @InjectRepository(ShiftAssignment)
    private assignRepo: Repository<ShiftAssignment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
  ) {}

  private isManagerOrAbove(role: UserRole) {
    return role !== UserRole.EMPLOYEE;
  }

  // ── 스냅샷 헬퍼 ──────────────────────────────────────────
  private snapshot(a: ShiftAssignment) {
    return {
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      shiftType: a.shiftType,
    };
  }

  // ── 시프트 레이블 ─────────────────────────────────────────
  private shiftLabel(snap: { date: string; startTime: string | null; endTime: string | null } | null) {
    if (!snap) return '시프트';
    const time = snap.startTime ? `${snap.startTime}~${snap.endTime ?? '?'}` : '';
    return `${snap.date} ${time}`.trim();
  }

  // ════════════════════════════════════════════════════════
  // 1. 목록 조회
  // ════════════════════════════════════════════════════════

  /** 교환 요청 목록
   * - 관리자: 회사 전체
   * - 직원: 본인 관련(요청자 or 대상자) + open 상태 (대타 게시판용)
   */
  async findAll(user: AuthenticatedUser, query: SwapQueryDto) {
    const qb = this.swapRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.requester', 'requester')
      .leftJoinAndSelect('sr.targetUser', 'targetUser')
      .leftJoinAndSelect('sr.approver', 'approver')
      .where('sr.company_id = :cid', { cid: user.companyId })
      .orderBy('sr.created_at', 'DESC');

    if (!this.isManagerOrAbove(user.role)) {
      qb.andWhere(
        '(sr.requester_id = :uid OR sr.target_user_id = :uid OR sr.status = :open)',
        { uid: user.id, open: SwapStatus.PENDING_PEER },
      );
    }

    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim());
      qb.andWhere('sr.status IN (:...statuses)', { statuses });
    }

    const list = await qb.getMany();
    return list;
  }

  /** 대타 게시판 — 전 직원이 볼 수 있는 open 요청 */
  async findBoard(user: AuthenticatedUser) {
    return this.swapRepo.find({
      where: { companyId: user.companyId, status: SwapStatus.PENDING_PEER, type: SwapType.COVER },
      relations: ['requester'],
      order: { createdAt: 'DESC' },
    });
  }

  // ════════════════════════════════════════════════════════
  // 2. 교환 신청 생성
  // ════════════════════════════════════════════════════════
  async create(user: AuthenticatedUser, dto: CreateSwapRequestDto) {
    // 내 시프트 검증
    const myAssignment = await this.assignRepo.findOne({
      where: { id: dto.requesterAssignmentId, companyId: user.companyId },
    });
    if (!myAssignment) throw new NotFoundException('내 시프트를 찾을 수 없습니다.');
    if (myAssignment.userId !== user.id) throw new ForbiddenException('본인의 시프트만 교환 신청할 수 있습니다.');

    // 이미 진행 중인 교환 요청이 있는지 확인
    const existing = await this.swapRepo.findOne({
      where: {
        requesterAssignmentId: myAssignment.id,
        status: In([SwapStatus.PENDING_PEER, SwapStatus.PENDING_APPROVAL]),
      },
    });
    if (existing) throw new BadRequestException('이 시프트에 이미 진행 중인 교환 요청이 있습니다.');

    let targetAssignment: ShiftAssignment | null = null;

    if (dto.type === SwapType.SWAP) {
      if (!dto.targetUserId || !dto.targetAssignmentId) {
        throw new BadRequestException('1:1 교환 신청 시 상대방과 상대방 시프트를 지정해야 합니다.');
      }
      if (dto.targetUserId === user.id) {
        throw new BadRequestException('자신과 교환 신청할 수 없습니다.');
      }
      targetAssignment = await this.assignRepo.findOne({
        where: { id: dto.targetAssignmentId, companyId: user.companyId, userId: dto.targetUserId },
      });
      if (!targetAssignment) throw new NotFoundException('상대방 시프트를 찾을 수 없습니다.');
    }

    const swap = this.swapRepo.create({
      companyId: user.companyId,
      requesterId: user.id,
      requesterAssignmentId: myAssignment.id,
      requesterShiftSnapshot: this.snapshot(myAssignment),
      targetUserId: dto.targetUserId ?? null,
      targetAssignmentId: targetAssignment?.id ?? null,
      targetShiftSnapshot: targetAssignment ? this.snapshot(targetAssignment) : null,
      type: dto.type,
      status: SwapStatus.PENDING_PEER,
      requesterNote: dto.requesterNote ?? null,
    });
    const saved = await this.swapRepo.save(swap);

    // 알림 발송
    if (dto.type === SwapType.SWAP && dto.targetUserId) {
      const target = await this.userRepo.findOne({ where: { id: dto.targetUserId } });
      if (target) {
        await this.notificationsService.dispatch({
          userId: target.id,
          companyId: user.companyId,
          type: 'shift_swap_requested',
          title: '근무 교환 신청',
          body: `${user.name}님이 ${this.shiftLabel(saved.requesterShiftSnapshot)} ↔ ${this.shiftLabel(saved.targetShiftSnapshot)} 교환을 신청했습니다.`,
          refType: 'shift_swap',
          refId: saved.id,
        });
      }
    } else if (dto.type === SwapType.COVER) {
      // 같은 회사 전 직원에게 게시판 알림 (본인 제외)
      const colleagues = await this.userRepo.find({
        where: { companyId: user.companyId, deletedAt: IsNull() },
        select: ['id'],
      });
      await Promise.all(
        colleagues
          .filter((c) => c.id !== user.id)
          .map((c) =>
            this.notificationsService.dispatch({
              userId: c.id,
              companyId: user.companyId,
              type: 'shift_swap_cover_posted',
              title: '대타 모집',
              body: `${user.name}님이 ${this.shiftLabel(saved.requesterShiftSnapshot)} 대타를 구하고 있습니다.`,
              refType: 'shift_swap',
              refId: saved.id,
            }),
          ),
      );
    }

    return saved;
  }

  // ════════════════════════════════════════════════════════
  // 3. 상대방(B) 응답 — swap 전용
  // ════════════════════════════════════════════════════════
  async peerRespond(user: AuthenticatedUser, id: string, dto: PeerRespondDto) {
    const swap = await this.swapRepo.findOne({
      where: { id, companyId: user.companyId },
      relations: ['requester', 'targetUser'],
    });
    if (!swap) throw new NotFoundException('교환 요청을 찾을 수 없습니다.');
    if (swap.targetUserId !== user.id) throw new ForbiddenException('해당 교환 요청의 대상자가 아닙니다.');
    if (swap.status !== SwapStatus.PENDING_PEER) {
      throw new BadRequestException(`현재 상태(${swap.status})에서는 응답할 수 없습니다.`);
    }
    if (swap.type !== SwapType.SWAP) {
      throw new BadRequestException('대타 모집은 volunteer 엔드포인트를 사용하세요.');
    }

    if (dto.accept) {
      swap.status = SwapStatus.PENDING_APPROVAL;
      swap.peerNote = dto.peerNote ?? null;
      await this.swapRepo.save(swap);

      // A에게 수락 알림
      await this.notificationsService.dispatch({
        userId: swap.requesterId,
        companyId: swap.companyId,
        type: 'shift_swap_peer_accepted',
        title: '교환 수락됨',
        body: `${user.name}님이 근무 교환을 수락했습니다. 업주 최종 승인을 기다리고 있습니다.`,
        refType: 'shift_swap',
        refId: swap.id,
      });
      // 업주·관리자에게 승인 요청 알림
      await this._notifyManagers(swap.companyId, {
        type: 'shift_swap_peer_accepted',
        title: '근무 교환 승인 요청',
        body: `${swap.requester.name} ↔ ${user.name} 근무 교환 — 최종 승인이 필요합니다.`,
        refId: swap.id,
      });
    } else {
      swap.status = SwapStatus.PEER_DECLINED;
      swap.peerNote = dto.peerNote ?? null;
      await this.swapRepo.save(swap);

      // A에게 거절 알림
      await this.notificationsService.dispatch({
        userId: swap.requesterId,
        companyId: swap.companyId,
        type: 'shift_swap_peer_declined',
        title: '교환 거절됨',
        body: `${user.name}님이 근무 교환을 거절했습니다.${dto.peerNote ? ` 사유: ${dto.peerNote}` : ''}`,
        refType: 'shift_swap',
        refId: swap.id,
      });
    }

    return swap;
  }

  // ════════════════════════════════════════════════════════
  // 4. 대타 자원 — cover 전용
  // ════════════════════════════════════════════════════════
  async volunteer(user: AuthenticatedUser, id: string, dto: VolunteerDto) {
    const swap = await this.swapRepo.findOne({
      where: { id, companyId: user.companyId },
      relations: ['requester'],
    });
    if (!swap) throw new NotFoundException('교환 요청을 찾을 수 없습니다.');
    if (swap.type !== SwapType.COVER) throw new BadRequestException('대타 모집 요청이 아닙니다.');
    if (swap.requesterId === user.id) throw new BadRequestException('자신의 대타 요청에 자원할 수 없습니다.');
    if (swap.status !== SwapStatus.PENDING_PEER) {
      throw new BadRequestException('이미 자원자가 있거나 처리 완료된 요청입니다.');
    }

    swap.targetUserId = user.id;
    swap.status = SwapStatus.PENDING_APPROVAL;
    swap.peerNote = dto.peerNote ?? null;
    await this.swapRepo.save(swap);

    // 요청자 A에게 알림
    await this.notificationsService.dispatch({
      userId: swap.requesterId,
      companyId: swap.companyId,
      type: 'shift_swap_volunteered',
      title: '대타 자원자',
      body: `${user.name}님이 ${this.shiftLabel(swap.requesterShiftSnapshot)} 대타를 자원했습니다. 업주 최종 승인을 기다리고 있습니다.`,
      refType: 'shift_swap',
      refId: swap.id,
    });
    // 업주·관리자에게 알림
    await this._notifyManagers(swap.companyId, {
      type: 'shift_swap_volunteered',
      title: '대타 자원 — 승인 요청',
      body: `${user.name}님이 ${swap.requester.name}님의 대타를 자원했습니다. 최종 승인이 필요합니다.`,
      refId: swap.id,
    });

    return swap;
  }

  // ════════════════════════════════════════════════════════
  // 5. 업주·관리자 최종 승인
  // ════════════════════════════════════════════════════════
  async approve(user: AuthenticatedUser, id: string, dto: ApproveRejectDto) {
    if (!this.isManagerOrAbove(user.role)) throw new ForbiddenException('관리자만 승인할 수 있습니다.');

    const swap = await this.swapRepo.findOne({
      where: { id, companyId: user.companyId },
      relations: ['requesterAssignment', 'targetAssignment'],
    });
    if (!swap) throw new NotFoundException('교환 요청을 찾을 수 없습니다.');
    if (swap.status !== SwapStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`현재 상태(${swap.status})에서는 승인할 수 없습니다.`);
    }

    // 트랜잭션: 시프트 실제 교환
    await this.dataSource.transaction(async (manager) => {
      const reqAssign = swap.requesterAssignment;
      const tgtAssign = swap.targetAssignment;

      if (swap.type === SwapType.SWAP && reqAssign && tgtAssign) {
        // 두 시프트의 userId를 서로 교환
        const tempUserId = reqAssign.userId;
        reqAssign.userId = tgtAssign.userId;
        tgtAssign.userId = tempUserId;
        await manager.save(ShiftAssignment, reqAssign);
        await manager.save(ShiftAssignment, tgtAssign);
      } else if (swap.type === SwapType.COVER && reqAssign && swap.targetUserId) {
        // 대타: requester 시프트의 userId를 자원자로 교체
        reqAssign.userId = swap.targetUserId;
        await manager.save(ShiftAssignment, reqAssign);
      }

      // swap 상태 업데이트
      await manager.update(ShiftSwapRequest, id, {
        status: SwapStatus.APPROVED,
        approverId: user.id,
        approverNote: dto.approverNote ?? null,
        approvedAt: new Date(),
      });
    });

    // A·B 양쪽에 승인 알림
    const recipients = [swap.requesterId, swap.targetUserId].filter(Boolean) as string[];
    await Promise.all(
      recipients.map((uid) =>
        this.notificationsService.dispatch({
          userId: uid,
          companyId: swap.companyId,
          type: 'shift_swap_approved',
          title: '근무 교환 승인',
          body: `근무 교환이 최종 승인되었습니다.${dto.approverNote ? ` 메모: ${dto.approverNote}` : ''}`,
          refType: 'shift_swap',
          refId: swap.id,
        }),
      ),
    );

    return this.swapRepo.findOne({ where: { id } });
  }

  // ════════════════════════════════════════════════════════
  // 6. 업주·관리자 거절
  // ════════════════════════════════════════════════════════
  async reject(user: AuthenticatedUser, id: string, dto: ApproveRejectDto) {
    if (!this.isManagerOrAbove(user.role)) throw new ForbiddenException('관리자만 거절할 수 있습니다.');

    const swap = await this.swapRepo.findOne({
      where: { id, companyId: user.companyId },
    });
    if (!swap) throw new NotFoundException('교환 요청을 찾을 수 없습니다.');
    if (swap.status !== SwapStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`현재 상태(${swap.status})에서는 거절할 수 없습니다.`);
    }

    if (swap.type === SwapType.COVER) {
      // 대타 거절 시 → 다시 open 상태로 (다른 사람이 자원 가능)
      swap.status = SwapStatus.PENDING_PEER;
      swap.targetUserId = null;
      swap.peerNote = null;
    } else {
      swap.status = SwapStatus.REJECTED;
    }

    swap.approverId = user.id;
    swap.approverNote = dto.approverNote ?? null;
    await this.swapRepo.save(swap);

    // A에게 거절 알림
    await this.notificationsService.dispatch({
      userId: swap.requesterId,
      companyId: swap.companyId,
      type: 'shift_swap_rejected',
      title: '근무 교환 거절',
      body: `근무 교환 요청이 거절되었습니다.${dto.approverNote ? ` 사유: ${dto.approverNote}` : ''}${swap.type === SwapType.COVER ? ' (다른 자원자를 기다리는 중입니다.)' : ''}`,
      refType: 'shift_swap',
      refId: swap.id,
    });

    return swap;
  }

  // ════════════════════════════════════════════════════════
  // 7. 요청자 취소
  // ════════════════════════════════════════════════════════
  async cancel(user: AuthenticatedUser, id: string) {
    const swap = await this.swapRepo.findOne({
      where: { id, companyId: user.companyId },
    });
    if (!swap) throw new NotFoundException('교환 요청을 찾을 수 없습니다.');

    const cancellable = [SwapStatus.PENDING_PEER, SwapStatus.PEER_DECLINED];
    if (!cancellable.includes(swap.status) && swap.requesterId !== user.id) {
      throw new BadRequestException('취소할 수 없는 상태입니다.');
    }
    if (swap.requesterId !== user.id && !this.isManagerOrAbove(user.role)) {
      throw new ForbiddenException('본인의 요청만 취소할 수 있습니다.');
    }
    if (!cancellable.includes(swap.status)) {
      throw new BadRequestException(`현재 상태(${swap.status})에서는 취소할 수 없습니다.`);
    }

    swap.status = SwapStatus.CANCELLED;
    return this.swapRepo.save(swap);
  }

  // ════════════════════════════════════════════════════════
  // 내부: 업주·관리자 전체에게 알림
  // ════════════════════════════════════════════════════════
  private async _notifyManagers(companyId: string, opts: {
    type: any; title: string; body: string; refId: string;
  }) {
    const managers = await this.userRepo.find({
      where: [
        { companyId, role: UserRole.OWNER, deletedAt: IsNull() },
        { companyId, role: UserRole.MANAGER, deletedAt: IsNull() },
      ],
      select: ['id'],
    });
    await Promise.all(
      managers.map((m) =>
        this.notificationsService.dispatch({
          userId: m.id,
          companyId,
          type: opts.type,
          title: opts.title,
          body: opts.body,
          refType: 'shift_swap',
          refId: opts.refId,
        }),
      ),
    );
  }
}
