/**
 * 데모 시드 스크립트 — 가상 회사 "(주)한빛솔루션"
 * 실행: cd backend && npm run seed:demo
 *
 * 생성 데이터
 *   - 회사 1개
 *   - 직원 20명 (경영지원·인사·영업·CS·개발·생산팀)
 *   - 업무 24건 (부서별 현실적인 업무)
 *   - 출퇴근 기록 (최근 30 평일)
 *   - 연차 잔여 / 휴가 신청 6건
 *   - 전자결재 5건
 *   - 급여 (2월 PAID, 3월 CONFIRMED)
 *   - 캘린더 이벤트 8건
 *
 * 공통 비밀번호: Demo1234!
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../../app.module';
import { Company, CompanyPlan, CompanyType } from '../entities/company.entity';
import { User, UserStatus } from '../entities/user.entity';
import { UserRole } from '../../common/types/jwt-payload.type';
import { Task, TaskStatus, TaskPriority } from '../entities/task.entity';
import { AttendanceRecord, AttendanceStatus } from '../entities/attendance-record.entity';
import { VacationRequest, VacationType, VacationStatus } from '../entities/vacation-request.entity';
import { VacationBalance } from '../entities/vacation-balance.entity';
import { ApprovalDocument, ApprovalDocType, ApprovalDocStatus } from '../entities/approval-document.entity';
import { ApprovalStep, StepStatus } from '../entities/approval-step.entity';
import { Salary, SalaryStatus } from '../entities/salary.entity';
import { CalendarEvent, CalendarEventScope } from '../entities/calendar-event.entity';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function getWorkdays(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(cur.toISOString().split('T')[0]);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function kst(date: string, hour: number, min: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+09:00`);
}

function calcDeductions(base: number) {
  const nationalPension     = Math.round(base * 0.045);
  const healthInsurance     = Math.round(base * 0.03545);
  const careInsurance       = Math.round(healthInsurance * 0.1295);
  const employmentInsurance = Math.round(base * 0.009);
  const taxable = base - nationalPension - healthInsurance - careInsurance - employmentInsurance;
  const incomeTax = Math.max(0, Math.round(taxable * 0.06 - 150_000));
  const localTax  = Math.round(incomeTax * 0.1);
  return { nationalPension, healthInsurance, careInsurance, employmentInsurance, incomeTax, localTax };
}

// ─── 직원 정의 ────────────────────────────────────────────────────────────────

const EMP_DEFS = [
  // 경영지원팀
  { no: '001', name: '김성준', email: 'kim.seongjun@hanbit.demo', dept: '경영지원팀', position: '대표이사',    role: UserRole.OWNER,    base: 8_000_000, joined: '2020-01-02' },
  { no: '002', name: '이지은', email: 'lee.jieun@hanbit.demo',    dept: '경영지원팀', position: '경영지원팀장', role: UserRole.MANAGER,  base: 5_000_000, joined: '2020-03-02' },
  // 인사팀
  { no: '003', name: '박지영', email: 'park.jiyoung@hanbit.demo', dept: '인사팀',    position: '인사팀장',    role: UserRole.MANAGER,  base: 4_800_000, joined: '2020-06-01' },
  { no: '004', name: '최수민', email: 'choi.sumin@hanbit.demo',   dept: '인사팀',    position: '인사담당',    role: UserRole.EMPLOYEE, base: 3_400_000, joined: '2021-09-01' },
  { no: '005', name: '강현우', email: 'kang.hyunwoo@hanbit.demo', dept: '인사팀',    position: '인사담당',    role: UserRole.EMPLOYEE, base: 3_200_000, joined: '2022-03-07' },
  // 영업팀
  { no: '006', name: '정민호', email: 'jung.minho@hanbit.demo',   dept: '영업팀',    position: '영업팀장',    role: UserRole.MANAGER,  base: 4_500_000, joined: '2020-09-01' },
  { no: '007', name: '한소희', email: 'han.sohee@hanbit.demo',    dept: '영업팀',    position: '영업사원',    role: UserRole.EMPLOYEE, base: 3_200_000, joined: '2022-01-10' },
  { no: '008', name: '오태준', email: 'oh.taejun@hanbit.demo',    dept: '영업팀',    position: '영업사원',    role: UserRole.EMPLOYEE, base: 3_000_000, joined: '2022-07-04' },
  { no: '009', name: '임채원', email: 'lim.chaewon@hanbit.demo',  dept: '영업팀',    position: '영업대리',    role: UserRole.EMPLOYEE, base: 3_500_000, joined: '2021-04-05' },
  // CS팀
  { no: '010', name: '조나연', email: 'jo.nayeon@hanbit.demo',    dept: 'CS팀',      position: 'CS팀장',      role: UserRole.MANAGER,  base: 4_500_000, joined: '2020-11-02' },
  { no: '011', name: '윤서진', email: 'yoon.seojin@hanbit.demo',  dept: 'CS팀',      position: 'CS상담원',    role: UserRole.EMPLOYEE, base: 2_900_000, joined: '2023-01-09' },
  { no: '012', name: '신동현', email: 'shin.donghyun@hanbit.demo',dept: 'CS팀',      position: 'CS상담원',    role: UserRole.EMPLOYEE, base: 2_800_000, joined: '2023-07-03' },
  // 개발팀
  { no: '013', name: '배민준', email: 'bae.minjun@hanbit.demo',   dept: '개발팀',    position: '개발팀장',    role: UserRole.MANAGER,  base: 5_500_000, joined: '2020-02-03' },
  { no: '014', name: '류지호', email: 'ryu.jiho@hanbit.demo',     dept: '개발팀',    position: '시니어개발자', role: UserRole.EMPLOYEE, base: 4_500_000, joined: '2021-01-04' },
  { no: '015', name: '송아름', email: 'song.areum@hanbit.demo',   dept: '개발팀',    position: '개발자',      role: UserRole.EMPLOYEE, base: 3_800_000, joined: '2022-05-02' },
  { no: '016', name: '장태양', email: 'jang.taeyang@hanbit.demo', dept: '개발팀',    position: '개발자',      role: UserRole.EMPLOYEE, base: 3_500_000, joined: '2023-02-06' },
  // 생산팀
  { no: '017', name: '홍길동', email: 'hong.gildong@hanbit.demo', dept: '생산팀',    position: '생산팀장',    role: UserRole.MANAGER,  base: 4_200_000, joined: '2020-04-01' },
  { no: '018', name: '김태민', email: 'kim.taemin@hanbit.demo',   dept: '생산팀',    position: '생산직',      role: UserRole.EMPLOYEE, base: 2_900_000, joined: '2021-11-01' },
  { no: '019', name: '이하은', email: 'lee.haeun@hanbit.demo',    dept: '생산팀',    position: '생산직',      role: UserRole.EMPLOYEE, base: 2_800_000, joined: '2022-08-01' },
  { no: '020', name: '박준서', email: 'park.junseo@hanbit.demo',  dept: '생산팀',    position: '생산직',      role: UserRole.EMPLOYEE, base: 2_800_000, joined: '2023-03-06' },
];

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 데모 시드 시작 — (주)한빛솔루션\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const companyRepo  = app.get<Repository<Company>>(getRepositoryToken(Company));
  const userRepo     = app.get<Repository<User>>(getRepositoryToken(User));
  const taskRepo     = app.get<Repository<Task>>(getRepositoryToken(Task));
  const attRepo      = app.get<Repository<AttendanceRecord>>(getRepositoryToken(AttendanceRecord));
  const vacReqRepo   = app.get<Repository<VacationRequest>>(getRepositoryToken(VacationRequest));
  const vacBalRepo   = app.get<Repository<VacationBalance>>(getRepositoryToken(VacationBalance));
  const approvalRepo = app.get<Repository<ApprovalDocument>>(getRepositoryToken(ApprovalDocument));
  const stepRepo     = app.get<Repository<ApprovalStep>>(getRepositoryToken(ApprovalStep));
  const salaryRepo   = app.get<Repository<Salary>>(getRepositoryToken(Salary));
  const calRepo      = app.get<Repository<CalendarEvent>>(getRepositoryToken(CalendarEvent));

  // 중복 실행 방지
  const existing = await companyRepo.findOne({ where: { businessNumber: '123-45-67890' } });
  if (existing) {
    console.log('⚠️  이미 시드 데이터가 존재합니다 (사업자번호 123-45-67890). 종료합니다.\n');
    await app.close();
    return;
  }

  // ── 1. 회사 ───────────────────────────────────────────────────────────────
  console.log('📌 [1/9] 회사 생성...');
  const company = await companyRepo.save(companyRepo.create({
    name: '(주)한빛솔루션',
    businessNumber: '123-45-67890',
    companyType: CompanyType.CORPORATION,
    representativeName: '김성준',
    businessType: '제조업, 서비스업',
    businessItem: 'IT 솔루션, 전자부품 제조',
    industry: 'IT/제조',
    address: '서울특별시 강남구 테헤란로 123, 한빛타워 5층',
    phone: '02-1234-5678',
    plan: CompanyPlan.PRO,
    maxMembers: 50,
    workStartTime: '09:00',
    workEndTime: '18:00',
    lateThresholdMin: 10,
    timezone: 'Asia/Seoul',
    workDays: [1, 2, 3, 4, 5],
    gpsEnabled: false,
  }));
  console.log(`  ✅ ${company.name} (${company.id})`);

  // ── 2. 직원 ───────────────────────────────────────────────────────────────
  console.log('📌 [2/9] 직원 20명 생성...');
  const passwordHash = await bcrypt.hash('Demo1234!', 10);
  const users: User[] = [];

  for (const def of EMP_DEFS) {
    const u = await userRepo.save(userRepo.create({
      companyId:      company.id,
      name:           def.name,
      email:          def.email,
      passwordHash,
      employeeNumber: `EMP${def.no}`,
      department:     def.dept,
      position:       def.position,
      role:           def.role,
      status:         UserStatus.ACTIVE,
      joinedAt:       new Date(def.joined),
      permissions: def.role === UserRole.MANAGER ? {
        canInvite: true, canManagePayroll: true,
        canManageContracts: true, canManageEvaluations: true,
      } : null,
    }));
    users.push(u);
    process.stdout.write(`  → ${def.name} (${def.dept} / ${def.role})\n`);
  }

  // 편의 변수
  const byName = (name: string) => users.find(u => u.name === name)!;
  const cid = company.id;

  // ── 3. 업무 ───────────────────────────────────────────────────────────────
  console.log('📌 [3/9] 업무 24건 생성...');
  const taskDefs: Partial<Task>[] = [
    // 인사팀
    { companyId: cid, creatorId: byName('박지영').id, assigneeId: byName('최수민').id,
      title: '신입사원 온보딩 자료 준비', category: '인사관리', priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS, dueDate: '2026-04-10',
      description: '4월 신규 입사자 2명 온보딩 체크리스트 및 안내 자료 작성' },
    { companyId: cid, creatorId: byName('박지영').id, assigneeId: byName('강현우').id,
      title: '4월 급여 명세서 발송', category: '급여', priority: TaskPriority.URGENT,
      status: TaskStatus.PENDING, dueDate: '2026-04-25',
      description: '전 직원 4월분 급여 명세서 이메일 발송' },
    { companyId: cid, creatorId: byName('박지영').id, assigneeId: byName('최수민').id,
      title: '1분기 연차 현황 정리 보고서', category: '인사관리', priority: TaskPriority.NORMAL,
      status: TaskStatus.DONE, dueDate: '2026-03-31',
      description: '1분기 연차 사용 현황 집계 및 경영진 보고' },
    { companyId: cid, creatorId: byName('박지영').id, assigneeId: byName('강현우').id,
      title: '4대보험 취득신고 - 3월 입사자', category: '노무', priority: TaskPriority.HIGH,
      status: TaskStatus.DONE, dueDate: '2026-03-20',
      description: '3월 신규 입사자 4대보험 취득신고 처리 완료' },
    { companyId: cid, creatorId: byName('박지영').id, assigneeId: byName('박지영').id,
      title: '2분기 인사평가 일정 공지', category: '인사관리', priority: TaskPriority.NORMAL,
      status: TaskStatus.IN_PROGRESS, dueDate: '2026-04-15',
      description: '2분기 인사평가 일정 및 평가 기준 전 직원 공지' },

    // 영업팀
    { companyId: cid, creatorId: byName('정민호').id, assigneeId: byName('정민호').id,
      title: 'Q1 영업 실적 보고서 작성', category: '보고', priority: TaskPriority.HIGH,
      status: TaskStatus.DONE, dueDate: '2026-03-31',
      description: '1분기 전체 영업 실적 정리 및 경영진 보고' },
    { companyId: cid, creatorId: byName('정민호').id, assigneeId: byName('한소희').id,
      title: '신규 고객사 미팅 준비 - (주)대성전자', category: '영업', priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS, dueDate: '2026-04-08',
      description: '제안서, 소개자료, 샘플 키트 준비' },
    { companyId: cid, creatorId: byName('정민호').id, assigneeId: byName('오태준').id,
      title: '영업 제안서 작성 - ABC물산', category: '영업', priority: TaskPriority.NORMAL,
      status: TaskStatus.IN_PROGRESS, dueDate: '2026-04-12',
      description: 'ABC물산 신규 납품 계약 제안서 초안 작성' },
    { companyId: cid, creatorId: byName('정민호').id, assigneeId: byName('임채원').id,
      title: '계약서 검토 - XYZ솔루션 유지보수 갱신', category: '계약', priority: TaskPriority.HIGH,
      status: TaskStatus.REVIEW, dueDate: '2026-04-05',
      description: 'XYZ솔루션과의 유지보수 계약 갱신 조건 검토' },
    { companyId: cid, creatorId: byName('정민호').id, assigneeId: byName('임채원').id,
      title: '4월 영업 목표 설정 및 배분', category: '보고', priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING, dueDate: '2026-04-07',
      description: '팀원별 4월 목표 수주금액 및 방문 건수 설정' },

    // CS팀
    { companyId: cid, creatorId: byName('조나연').id, assigneeId: byName('윤서진').id,
      title: '3월 고객 불만 처리 보고서', category: '고객관리', priority: TaskPriority.HIGH,
      status: TaskStatus.DONE, dueDate: '2026-03-31',
      description: '3월 접수 고객 불만 건 분류·처리 결과 보고' },
    { companyId: cid, creatorId: byName('조나연').id, assigneeId: byName('신동현').id,
      title: 'FAQ 페이지 업데이트 (20건 추가)', category: '고객관리', priority: TaskPriority.NORMAL,
      status: TaskStatus.IN_PROGRESS, dueDate: '2026-04-14',
      description: '최근 1개월 상담 유형 분석하여 자주 묻는 질문 20건 추가' },
    { companyId: cid, creatorId: byName('조나연').id, assigneeId: byName('조나연').id,
      title: '1분기 고객 만족도 조사 결과 분석', category: '보고', priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING, dueDate: '2026-04-20',
      description: 'NPS 조사 결과 분석 및 서비스 개선 방향 도출' },
    { companyId: cid, creatorId: byName('조나연').id, assigneeId: byName('신동현').id,
      title: 'CS 응대 매뉴얼 v3.0 개정', category: '고객관리', priority: TaskPriority.LOW,
      status: TaskStatus.REVIEW, dueDate: '2026-04-25',
      description: '신제품 출시에 맞춰 응대 스크립트 업데이트 및 검토' },

    // 개발팀
    { companyId: cid, creatorId: byName('배민준').id, assigneeId: byName('류지호').id,
      title: 'REST API 문서 업데이트 (v2.1)', category: '개발', priority: TaskPriority.NORMAL,
      status: TaskStatus.IN_PROGRESS, dueDate: '2026-04-11',
      description: '신규 엔드포인트 Swagger 문서 작성 및 예제 코드 추가' },
    { companyId: cid, creatorId: byName('배민준').id, assigneeId: byName('장태양').id,
      title: '모바일 앱 로그인 세션 버그 수정', category: '개발', priority: TaskPriority.URGENT,
      status: TaskStatus.DONE, dueDate: '2026-03-28',
      description: '토큰 만료 시 자동 로그아웃 미작동 버그 수정' },
    { companyId: cid, creatorId: byName('배민준').id, assigneeId: byName('배민준').id,
      title: '결제 모듈 보안 코드 리뷰', category: '개발', priority: TaskPriority.HIGH,
      status: TaskStatus.REVIEW, dueDate: '2026-04-04',
      description: '장태양 개발 결제 모듈 보안 취약점 점검 및 피드백' },
    { companyId: cid, creatorId: byName('배민준').id, assigneeId: byName('배민준').id,
      title: '4월 스프린트 계획 수립', category: '개발', priority: TaskPriority.HIGH,
      status: TaskStatus.DONE, dueDate: '2026-04-01',
      description: '2주 스프린트 백로그 정리 및 팀원별 업무 배분 완료' },
    { companyId: cid, creatorId: byName('배민준').id, assigneeId: byName('송아름').id,
      title: '대시보드 렌더링 성능 최적화', category: '개발', priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING, dueDate: '2026-04-18',
      description: '메인 대시보드 LCP 3초 → 1.5초 이하로 개선 (코드 스플리팅, 이미지 최적화)' },

    // 생산팀
    { companyId: cid, creatorId: byName('홍길동').id, assigneeId: byName('홍길동').id,
      title: '3월 생산 목표 달성 점검 보고', category: '생산관리', priority: TaskPriority.HIGH,
      status: TaskStatus.DONE, dueDate: '2026-03-31',
      description: '3월 생산량 vs 목표치 비교 분석 및 원인 보고 (달성률 97.3%)' },
    { companyId: cid, creatorId: byName('홍길동').id, assigneeId: byName('김태민').id,
      title: '설비 월간 점검 보고서 (라인 1·2호)', category: '생산관리', priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS, dueDate: '2026-04-07',
      description: '컨베이어 벨트, 모터, 센서 점검 및 이상 유무 기록' },
    { companyId: cid, creatorId: byName('홍길동').id, assigneeId: byName('이하은').id,
      title: '불량률 개선 계획서 작성', category: '품질관리', priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING, dueDate: '2026-04-15',
      description: '3월 불량률 2.3% → 목표 1.5% 이하 개선 방안 수립' },
    { companyId: cid, creatorId: byName('홍길동').id, assigneeId: byName('홍길동').id,
      title: '상반기 안전 교육 일정 수립', category: '안전', priority: TaskPriority.HIGH,
      status: TaskStatus.REVIEW, dueDate: '2026-04-10',
      description: '산업안전보건법에 따른 반기 교육 일정 및 외부 강사 섭외' },
    { companyId: cid, creatorId: byName('홍길동').id, assigneeId: byName('박준서').id,
      title: '5월분 원자재 재고 점검 및 발주', category: '생산관리', priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING, dueDate: '2026-04-09',
      description: '현재 재고 수량 확인 후 5월분 원자재 발주 처리' },
  ];

  for (const t of taskDefs) {
    await taskRepo.save(taskRepo.create(t));
  }
  console.log(`  ✅ 업무 ${taskDefs.length}건`);

  // ── 4. 출퇴근 기록 ────────────────────────────────────────────────────────
  console.log('📌 [4/9] 출퇴근 기록 생성 (최근 30 평일)...');
  const workdays = getWorkdays(new Date('2026-03-03'), new Date('2026-04-01'));

  // 직원 유형별 출퇴근 패턴 정의
  const attPatterns = [
    { inH: 8, inM: 52, outH: 18, outM: 10, late: false },
    { inH: 8, inM: 58, outH: 18, outM: 5,  late: false },
    { inH: 9, inM: 0,  outH: 18, outM: 30, late: false },
    { inH: 9, inM: 22, outH: 18, outM: 40, late: true  },
    { inH: 8, inM: 45, outH: 19, outM: 15, late: false },
    { inH: 8, inM: 50, outH: 17, outM: 55, late: false },
    { inH: 9, inM: 35, outH: 18, outM: 50, late: true  },
    { inH: 8, inM: 55, outH: 18, outM: 20, late: false },
  ];

  let attCount = 0;
  for (let ui = 0; ui < users.length; ui++) {
    const u = users[ui];
    for (let di = 0; di < workdays.length; di++) {
      // ~5% 결근
      if ((ui * 3 + di * 7) % 20 === 0) continue;
      const date = workdays[di];
      const pat  = attPatterns[(ui + di) % attPatterns.length];
      const inMinOffset  = (di % 5);
      const outMinOffset = (di % 7);
      const clockIn  = kst(date, pat.inH, pat.inM + inMinOffset);
      const clockOut = kst(date, pat.outH, pat.outM + outMinOffset);
      const totalMin = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);

      await attRepo.save(attRepo.create({
        companyId: cid,
        userId:    u.id,
        workDate:  date,
        clockInAt: clockIn,
        clockOutAt: clockOut,
        status:    pat.late ? AttendanceStatus.LATE : AttendanceStatus.NORMAL,
        isLate:    pat.late,
        lateMinutes: pat.late ? 12 + (di % 18) : null,
        totalWorkMinutes: totalMin,
      }));
      attCount++;
    }
  }
  console.log(`  ✅ 출퇴근 기록 ${attCount}건`);

  // ── 5. 연차 잔여 (2026년) ─────────────────────────────────────────────────
  console.log('📌 [5/9] 연차 잔여 생성...');
  const usedMap: Record<string, number> = { '004': 3, '005': 1.5, '007': 2, '011': 0.5, '020': 4 };
  const today = new Date('2026-04-02');
  for (let i = 0; i < EMP_DEFS.length; i++) {
    const def  = EMP_DEFS[i];
    const user = users[i];
    const years = Math.floor((today.getTime() - new Date(def.joined).getTime()) / (365.25 * 24 * 3600 * 1000));
    await vacBalRepo.save(vacBalRepo.create({
      companyId: cid,
      userId:    user.id,
      year:      2026,
      totalDays: years < 1 ? 11 : 15,
      usedDays:  usedMap[def.no] ?? 0,
      adjustDays: 0,
    }));
  }
  console.log(`  ✅ 연차 잔여 ${EMP_DEFS.length}건`);

  // ── 6. 휴가 신청 ──────────────────────────────────────────────────────────
  console.log('📌 [6/9] 휴가 신청 생성...');
  const vacDefs = [
    { user: byName('강현우'), type: VacationType.ANNUAL,      start: '2026-03-17', end: '2026-03-19', days: 3,   status: VacationStatus.APPROVED, reason: '개인 사유',  approver: byName('박지영') },
    { user: byName('윤서진'), type: VacationType.HALF_DAY_AM, start: '2026-03-24', end: '2026-03-24', days: 0.5, status: VacationStatus.APPROVED, reason: '병원 진료', approver: byName('조나연') },
    { user: byName('한소희'), type: VacationType.ANNUAL,      start: '2026-04-07', end: '2026-04-07', days: 1,   status: VacationStatus.PENDING,  reason: '개인 사정',  approver: null },
    { user: byName('박준서'), type: VacationType.SICK,        start: '2026-03-20', end: '2026-03-21', days: 2,   status: VacationStatus.APPROVED, reason: '독감',      approver: byName('홍길동') },
    { user: byName('송아름'), type: VacationType.ANNUAL,      start: '2026-04-14', end: '2026-04-15', days: 2,   status: VacationStatus.PENDING,  reason: '여행',      approver: null },
    { user: byName('오태준'), type: VacationType.HALF_DAY_PM, start: '2026-04-03', end: '2026-04-03', days: 0.5, status: VacationStatus.APPROVED, reason: '개인 사무', approver: byName('정민호') },
  ];

  for (const v of vacDefs) {
    await vacReqRepo.save(vacReqRepo.create({
      companyId:  cid,
      userId:     v.user.id,
      type:       v.type,
      startDate:  v.start,
      endDate:    v.end,
      days:       v.days,
      reason:     v.reason,
      status:     v.status,
      approverId: v.approver?.id ?? null,
      approvedAt: v.status === VacationStatus.APPROVED ? new Date('2026-03-16') : null,
    }));
  }
  console.log(`  ✅ 휴가 신청 ${vacDefs.length}건`);

  // ── 7. 전자결재 ───────────────────────────────────────────────────────────
  console.log('📌 [7/9] 전자결재 생성...');
  const approvalDefs = [
    {
      author: byName('한소희'), type: ApprovalDocType.BUSINESS_TRIP,
      title: '제주 고객사 출장 신청',
      content: '(주)제주테크 현장 미팅을 위한 출장 승인을 요청드립니다.\n\n일정: 2026-04-09 ~ 04-10 (1박2일)\n방문처: 제주시 첨단로 123 제주테크 본사\n예상 비용: 항공 + 숙박 약 350,000원',
      status: ApprovalDocStatus.APPROVED,
      steps: [{ approver: byName('정민호'), step: 1, status: StepStatus.APPROVED, comment: '출장 승인합니다. 안전하게 다녀오세요.' }],
    },
    {
      author: byName('오태준'), type: ApprovalDocType.OVERTIME,
      title: '연장근무 신청 - ABC물산 제안서 마감',
      content: 'ABC물산 제안서 제출 마감일이 촉박하여 연장근무 승인을 요청드립니다.\n일시: 2026-04-03(목) 18:00 ~ 21:00 (3시간)',
      status: ApprovalDocStatus.IN_PROGRESS,
      steps: [{ approver: byName('정민호'), step: 1, status: StepStatus.PENDING, comment: null }],
    },
    {
      author: byName('홍길동'), type: ApprovalDocType.EXPENSE,
      title: '생산 설비 부품 구매 승인 신청',
      content: '라인1호 컨베이어 벨트 마모로 인한 긴급 교체 부품 구매 승인을 요청드립니다.\n\n품목: 컨베이어 벨트 Type-A (2EA)\n공급업체: (주)한국산업부품\n금액: 850,000원 (VAT 포함)',
      status: ApprovalDocStatus.IN_PROGRESS,
      steps: [{ approver: byName('김성준'), step: 1, status: StepStatus.PENDING, comment: null }],
    },
    {
      author: byName('윤서진'), type: ApprovalDocType.VACATION,
      title: '오전 반차 신청 (2026-03-24)',
      content: '개인 병원 진료로 인해 오전 반차를 신청합니다.\n복귀 시간: 오후 1시 예정',
      status: ApprovalDocStatus.APPROVED,
      steps: [{ approver: byName('조나연'), step: 1, status: StepStatus.APPROVED, comment: '승인합니다. 쾌차하세요.' }],
    },
    {
      author: byName('장태양'), type: ApprovalDocType.GENERAL,
      title: 'GDG DevFest Seoul 2026 참가 신청',
      content: '기술 역량 강화를 위해 외부 개발자 컨퍼런스 참가를 신청합니다.\n\n행사명: GDG DevFest Seoul 2026\n일시: 2026-04-19(토)\n장소: 구글코리아 강남 오피스\n참가비: 30,000원',
      status: ApprovalDocStatus.DRAFT,
      steps: [],
    },
  ];

  for (const def of approvalDefs) {
    const doc = await approvalRepo.save(approvalRepo.create({
      companyId:   cid,
      authorId:    def.author.id,
      type:        def.type,
      title:       def.title,
      content:     def.content,
      status:      def.status,
      currentStep: def.status === ApprovalDocStatus.APPROVED ? 1 : 0,
      submittedAt: def.status !== ApprovalDocStatus.DRAFT ? new Date('2026-03-30') : null,
      completedAt: def.status === ApprovalDocStatus.APPROVED ? new Date('2026-04-01') : null,
    }));
    for (const s of def.steps) {
      await stepRepo.save(stepRepo.create({
        documentId: doc.id,
        approverId: s.approver.id,
        step:       s.step,
        status:     s.status,
        comment:    s.comment,
        actedAt:    s.status !== StepStatus.PENDING ? new Date('2026-04-01') : null,
      }));
    }
  }
  console.log(`  ✅ 전자결재 ${approvalDefs.length}건`);

  // ── 8. 급여 (2월 PAID, 3월 CONFIRMED) ────────────────────────────────────
  console.log('📌 [8/9] 급여 생성 (2·3월)...');
  let salaryCount = 0;

  for (const [month, status, paidAt] of [
    [2, SalaryStatus.PAID,      new Date('2026-02-25')] as const,
    [3, SalaryStatus.CONFIRMED, null                  ] as const,
  ]) {
    for (let i = 0; i < EMP_DEFS.length; i++) {
      const def  = EMP_DEFS[i];
      const user = users[i];
      const bonus = def.dept === '영업팀' && month === 2 ? 500_000 : 0;
      const d     = calcDeductions(def.base);
      await salaryRepo.save(salaryRepo.create({
        companyId:            cid,
        userId:               user.id,
        year:                 2026,
        month,
        baseSalary:           def.base,
        bonus,
        mealAllowance:        200_000,
        transportAllowance:   100_000,
        nationalPension:      d.nationalPension,
        healthInsurance:      d.healthInsurance,
        careInsurance:        d.careInsurance,
        employmentInsurance:  d.employmentInsurance,
        incomeTax:            d.incomeTax,
        localTax:             d.localTax,
        status,
        paidAt: paidAt ?? null,
        workDays:             20,
        workMinutes:          20 * 9 * 60,
        createdBy:            byName('박지영').id,
      }));
      salaryCount++;
    }
  }
  console.log(`  ✅ 급여 ${salaryCount}건`);

  // ── 9. 캘린더 이벤트 ─────────────────────────────────────────────────────
  console.log('📌 [9/9] 캘린더 이벤트 생성...');
  const calDefs = [
    { creator: byName('김성준'), scope: CalendarEventScope.COMPANY, dept: null,
      title: '4월 전사 타운홀 미팅',   start: '2026-04-10', end: '2026-04-10', color: '#3b82f6',
      desc: '전 직원 4월 목표 공유, 경영 현황 보고 및 Q&A' },
    { creator: byName('김성준'), scope: CalendarEventScope.COMPANY, dept: null,
      title: '창립기념일 (7주년)',      start: '2026-05-12', end: '2026-05-12', color: '#ec4899',
      desc: '(주)한빛솔루션 창립 7주년 기념 행사' },
    { creator: byName('박지영'), scope: CalendarEventScope.COMPANY, dept: null,
      title: '2분기 인사평가 기간',     start: '2026-04-21', end: '2026-04-25', color: '#06b6d4',
      desc: '자기평가(4/21~23) → 상사평가(4/24~25)' },
    { creator: byName('배민준'), scope: CalendarEventScope.TEAM, dept: '개발팀',
      title: '개발팀 스프린트 리뷰',   start: '2026-04-14', end: '2026-04-14', color: '#8b5cf6',
      desc: '4월 1주차 스프린트 결과 데모 및 회고' },
    { creator: byName('정민호'), scope: CalendarEventScope.TEAM, dept: '영업팀',
      title: '영업팀 4월 월례회의',    start: '2026-04-07', end: '2026-04-07', color: '#10b981',
      desc: '4월 목표 수주 계획 및 고객사 현황 공유' },
    { creator: byName('홍길동'), scope: CalendarEventScope.TEAM, dept: '생산팀',
      title: '생산팀 상반기 안전 교육', start: '2026-04-17', end: '2026-04-17', color: '#f59e0b',
      desc: '산업안전보건법 의무 교육 (외부 강사 초청)' },
    { creator: byName('조나연'), scope: CalendarEventScope.TEAM, dept: 'CS팀',
      title: 'CS팀 케이스 스터디',     start: '2026-04-16', end: '2026-04-16', color: '#10b981',
      desc: '3월 고객 불만 사례 분석 및 응대 개선 방안 논의' },
    { creator: byName('박지영'), scope: CalendarEventScope.TEAM, dept: '인사팀',
      title: '인사팀 노무 세미나',      start: '2026-04-23', end: '2026-04-23', color: '#06b6d4',
      desc: '2026년 개정 근로기준법 주요 내용 교육' },
  ];

  for (const ev of calDefs) {
    await calRepo.save(calRepo.create({
      companyId:        cid,
      creatorId:        ev.creator.id,
      scope:            ev.scope,
      targetDepartment: ev.dept,
      title:            ev.title,
      description:      ev.desc,
      startDate:        ev.start,
      endDate:          ev.end,
      color:            ev.color,
    }));
  }
  console.log(`  ✅ 캘린더 이벤트 ${calDefs.length}건`);

  // ─── 완료 출력 ─────────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(52));
  console.log('🎉 데모 시드 완료!');
  console.log('━'.repeat(52));
  console.log('  회사명     : (주)한빛솔루션');
  console.log('  직원 수    : 20명');
  console.log('  공통 비밀번호: Demo1234!\n');
  console.log('  ┌─ 역할별 테스트 계정 ──────────────────────┐');
  console.log('  │ owner    kim.seongjun@hanbit.demo   대표이사   │');
  console.log('  │ manager  park.jiyoung@hanbit.demo   인사팀장   │');
  console.log('  │ manager  jung.minho@hanbit.demo     영업팀장   │');
  console.log('  │ manager  jo.nayeon@hanbit.demo      CS팀장    │');
  console.log('  │ manager  bae.minjun@hanbit.demo     개발팀장   │');
  console.log('  │ manager  hong.gildong@hanbit.demo   생산팀장   │');
  console.log('  │ employee choi.sumin@hanbit.demo     인사담당   │');
  console.log('  │ employee han.sohee@hanbit.demo      영업사원   │');
  console.log('  │ employee yoon.seojin@hanbit.demo    CS상담원   │');
  console.log('  │ employee ryu.jiho@hanbit.demo       시니어개발자│');
  console.log('  │ employee kim.taemin@hanbit.demo     생산직     │');
  console.log('  └───────────────────────────────────────────┘\n');
  console.log('━'.repeat(52));

  await app.close();
}

main().catch((err) => {
  console.error('\n❌ 시드 실패:', err.message ?? err);
  process.exit(1);
});
