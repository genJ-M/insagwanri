import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Task } from '../../database/entities/task.entity';
import { ApprovalDocument } from '../../database/entities/approval-document.entity';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

export interface SearchIndexItem {
  type: 'employee' | 'task' | 'approval';
  id: string;
  label: string;
  sub: string;
  href: string;
}

const TASK_STATUS_LABEL: Record<string, string> = {
  pending:     '대기',
  in_progress: '진행 중',
  review:      '검토 중',
  done:        '완료',
  cancelled:   '취소',
};

const APPROVAL_STATUS_LABEL: Record<string, string> = {
  draft:       '기안 중',
  in_progress: '결재 진행',
  approved:    '승인',
  rejected:    '반려',
  cancelled:   '취소',
};

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User)             private userRepo: Repository<User>,
    @InjectRepository(Task)             private taskRepo: Repository<Task>,
    @InjectRepository(ApprovalDocument) private approvalRepo: Repository<ApprovalDocument>,
  ) {}

  async buildIndex(currentUser: AuthenticatedUser): Promise<SearchIndexItem[]> {
    const cid = currentUser.companyId;

    const [users, tasks, approvals] = await Promise.all([
      this.userRepo.find({
        where: { companyId: cid },
        select: ['id', 'name', 'department', 'position'],
        order: { createdAt: 'ASC' },
      }),

      this.taskRepo.find({
        where: { companyId: cid },
        select: ['id', 'title', 'status', 'assigneeId'],
        relations: ['assignee'],
        order: { createdAt: 'DESC' },
        take: 50,
      }),

      this.approvalRepo.find({
        where: { companyId: cid },
        select: ['id', 'title', 'status', 'type'],
        order: { createdAt: 'DESC' },
        take: 30,
      }),
    ]);

    const items: SearchIndexItem[] = [];

    for (const u of users) {
      items.push({
        type:  'employee',
        id:    u.id,
        label: u.name,
        sub:   [u.department, u.position].filter(Boolean).join(' · '),
        href:  `/team/${u.id}`,
      });
    }

    for (const t of tasks) {
      items.push({
        type:  'task',
        id:    t.id,
        label: t.title,
        sub:   [TASK_STATUS_LABEL[t.status] ?? t.status, (t as any).assignee?.name].filter(Boolean).join(' · '),
        href:  `/tasks`,
      });
    }

    for (const a of approvals) {
      items.push({
        type:  'approval',
        id:    a.id,
        label: a.title,
        sub:   APPROVAL_STATUS_LABEL[a.status] ?? a.status,
        href:  `/approvals`,
      });
    }

    return items;
  }
}
