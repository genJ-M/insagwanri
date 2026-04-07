export interface TemplatePlaceholder {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  defaultValue?: string;
  required: boolean;
  unit?: string; // 표시 단위 (원, 명, 일 등)
}

export interface ApprovalTemplate {
  id: string;
  category: 'purchase' | 'hr' | 'work' | 'planning' | 'general';
  categoryLabel: string;
  title: string;        // 기본 문서 제목
  docType: string;      // 매핑할 ApprovalDocType
  description: string;  // 간략 설명
  body: string;         // HTML with {{KEY}} placeholders (표시용)
  placeholders: TemplatePlaceholder[];
}

export const APPROVAL_TEMPLATES: ApprovalTemplate[] = [
  // ── 구매/재무 ──────────────────────────────────────
  {
    id: 'purchase_goods',
    category: 'purchase',
    categoryLabel: '구매/재무',
    title: '비품·소모품 구매요청',
    docType: 'expense',
    description: '업무용 비품, 소모품 등의 구매를 요청합니다.',
    body: `<h3>구매 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">구매 품목</td><td>{{ITEM_NAME}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">수량</td><td>{{QUANTITY}} {{UNIT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">단가</td><td>{{UNIT_PRICE}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">합계 금액</td><td>{{TOTAL_PRICE}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">구매 목적</td><td>{{PURPOSE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">납기 희망일</td><td>{{DEADLINE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">비고</td><td>{{NOTE}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 구매를 요청하오니 결재하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'ITEM_NAME',   label: '구매 품목',    type: 'text',     required: true },
      { key: 'QUANTITY',    label: '수량',          type: 'number',   required: true },
      { key: 'UNIT',        label: '단위',          type: 'select',   options: ['개', '박스', '세트', '롤', '장', '권', '병', '팩'], required: true, defaultValue: '개' },
      { key: 'UNIT_PRICE',  label: '단가 (원)',     type: 'number',   required: true },
      { key: 'TOTAL_PRICE', label: '합계 금액 (원)',type: 'number',   required: true },
      { key: 'PURPOSE',     label: '구매 목적',     type: 'textarea', required: true },
      { key: 'DEADLINE',    label: '납기 희망일',   type: 'date',     required: false },
      { key: 'NOTE',        label: '비고',          type: 'textarea', required: false },
    ],
  },
  {
    id: 'purchase_card',
    category: 'purchase',
    categoryLabel: '구매/재무',
    title: '법인카드 사용승인 요청',
    docType: 'expense',
    description: '법인카드 사용 전 사전 승인을 요청합니다.',
    body: `<h3>법인카드 사용승인 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">사용 목적</td><td>{{PURPOSE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">사용 예정 금액</td><td>{{AMOUNT}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">사용 일시</td><td>{{USE_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">사용처</td><td>{{VENDOR}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">참석 인원</td><td>{{ATTENDEES}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">비고</td><td>{{NOTE}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 법인카드 사용 승인을 요청합니다.</p>`,
    placeholders: [
      { key: 'PURPOSE',   label: '사용 목적',       type: 'textarea', required: true },
      { key: 'AMOUNT',    label: '예상 금액 (원)',   type: 'number',   required: true },
      { key: 'USE_DATE',  label: '사용 일시',        type: 'date',     required: true },
      { key: 'VENDOR',    label: '사용처 (업체명)',  type: 'text',     required: true },
      { key: 'ATTENDEES', label: '참석 인원',        type: 'text',     required: false },
      { key: 'NOTE',      label: '비고',             type: 'textarea', required: false },
    ],
  },
  {
    id: 'budget_request',
    category: 'purchase',
    categoryLabel: '구매/재무',
    title: '예산 편성·추가 요청',
    docType: 'expense',
    description: '사업 또는 프로젝트 예산 편성/추가를 요청합니다.',
    body: `<h3>예산 편성 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">예산 항목</td><td>{{BUDGET_ITEM}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">요청 금액</td><td>{{AMOUNT}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">집행 예정 기간</td><td>{{PERIOD}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">사용 계획</td><td>{{PLAN}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">기대 효과</td><td>{{EFFECT}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 예산 편성을 요청하오니 검토 후 승인하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'BUDGET_ITEM', label: '예산 항목',        type: 'text',     required: true },
      { key: 'AMOUNT',      label: '요청 금액 (원)',   type: 'number',   required: true },
      { key: 'PERIOD',      label: '집행 예정 기간',   type: 'text',     required: true },
      { key: 'PLAN',        label: '사용 계획',        type: 'textarea', required: true },
      { key: 'EFFECT',      label: '기대 효과',        type: 'textarea', required: false },
    ],
  },

  // ── 인사 ──────────────────────────────────────────
  {
    id: 'hiring_request',
    category: 'hr',
    categoryLabel: '인사',
    title: '인원충원 요청',
    docType: 'hr',
    description: '신규 채용 또는 결원 충원을 요청합니다.',
    body: `<h3>인원충원 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">충원 부서</td><td>{{DEPARTMENT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">직위/직급</td><td>{{POSITION}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">충원 인원</td><td>{{HEADCOUNT}} 명</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">충원 유형</td><td>{{HIRE_TYPE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">충원 사유</td><td>{{REASON}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">주요 업무</td><td>{{DUTIES}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">희망 입사일</td><td>{{START_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">우대 사항</td><td>{{PREFERRED}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 인원충원을 요청하오니 검토 후 승인하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'DEPARTMENT',  label: '충원 부서',     type: 'text',     required: true },
      { key: 'POSITION',    label: '직위/직급',     type: 'text',     required: true },
      { key: 'HEADCOUNT',   label: '충원 인원 (명)',type: 'number',   required: true, defaultValue: '1' },
      { key: 'HIRE_TYPE',   label: '충원 유형',     type: 'select',   options: ['정규직', '계약직', '인턴', '파견직', '프리랜서'], required: true, defaultValue: '정규직' },
      { key: 'REASON',      label: '충원 사유',     type: 'textarea', required: true },
      { key: 'DUTIES',      label: '주요 업무',     type: 'textarea', required: true },
      { key: 'START_DATE',  label: '희망 입사일',   type: 'date',     required: false },
      { key: 'PREFERRED',   label: '우대 사항',     type: 'textarea', required: false },
    ],
  },
  {
    id: 'resignation_process',
    category: 'hr',
    categoryLabel: '인사',
    title: '퇴사 처리요청',
    docType: 'hr',
    description: '직원 퇴사에 따른 처리를 요청합니다.',
    body: `<h3>퇴사 처리 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">퇴사자 성명</td><td>{{EMP_NAME}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">소속 부서</td><td>{{DEPARTMENT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">퇴사 예정일</td><td>{{RESIGN_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">퇴사 유형</td><td>{{RESIGN_TYPE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">퇴사 사유</td><td>{{REASON}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">업무 인수인계 담당자</td><td>{{HANDOVER_TO}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">인수인계 완료 예정일</td><td>{{HANDOVER_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">비고</td><td>{{NOTE}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 퇴사 처리를 요청하오니 승인하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'EMP_NAME',      label: '퇴사자 성명',           type: 'text',     required: true },
      { key: 'DEPARTMENT',    label: '소속 부서',              type: 'text',     required: true },
      { key: 'RESIGN_DATE',   label: '퇴사 예정일',           type: 'date',     required: true },
      { key: 'RESIGN_TYPE',   label: '퇴사 유형',             type: 'select',   options: ['자진퇴사', '권고사직', '계약만료', '정년퇴직'], required: true, defaultValue: '자진퇴사' },
      { key: 'REASON',        label: '퇴사 사유',             type: 'textarea', required: true },
      { key: 'HANDOVER_TO',   label: '인수인계 담당자',       type: 'text',     required: false },
      { key: 'HANDOVER_DATE', label: '인수인계 완료 예정일',  type: 'date',     required: false },
      { key: 'NOTE',          label: '비고',                  type: 'textarea', required: false },
    ],
  },
  {
    id: 'personnel_transfer',
    category: 'hr',
    categoryLabel: '인사',
    title: '인사 발령요청',
    docType: 'hr',
    description: '부서 이동, 직급 변경 등의 인사 발령을 요청합니다.',
    body: `<h3>인사 발령 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">대상자</td><td>{{EMP_NAME}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">발령 유형</td><td>{{TRANSFER_TYPE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">현재 부서/직급</td><td>{{FROM}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">발령 부서/직급</td><td>{{TO}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">발령 예정일</td><td>{{TRANSFER_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">발령 사유</td><td>{{REASON}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 인사 발령을 요청하오니 결재하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'EMP_NAME',      label: '대상자 성명',   type: 'text',   required: true },
      { key: 'TRANSFER_TYPE', label: '발령 유형',     type: 'select', options: ['부서 이동', '직급 승진', '직급 강등', '전보', '파견', '겸직'], required: true, defaultValue: '부서 이동' },
      { key: 'FROM',          label: '현재 부서/직급',type: 'text',   required: true },
      { key: 'TO',            label: '발령 부서/직급',type: 'text',   required: true },
      { key: 'TRANSFER_DATE', label: '발령 예정일',   type: 'date',   required: true },
      { key: 'REASON',        label: '발령 사유',     type: 'textarea', required: true },
    ],
  },
  {
    id: 'external_training',
    category: 'hr',
    categoryLabel: '인사',
    title: '외부교육 참가신청',
    docType: 'hr',
    description: '외부 교육·세미나 참가를 신청합니다.',
    body: `<h3>외부교육 참가신청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">교육명</td><td>{{TRAINING_NAME}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">주최 기관</td><td>{{ORGANIZER}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">교육 일정</td><td>{{TRAINING_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">교육 장소</td><td>{{LOCATION}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">교육 비용</td><td>{{COST}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">참가 목적</td><td>{{PURPOSE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">기대 효과</td><td>{{EFFECT}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 외부교육 참가를 신청하오니 승인하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'TRAINING_NAME', label: '교육명',         type: 'text',     required: true },
      { key: 'ORGANIZER',     label: '주최 기관',      type: 'text',     required: true },
      { key: 'TRAINING_DATE', label: '교육 일정',      type: 'text',     required: true },
      { key: 'LOCATION',      label: '교육 장소',      type: 'text',     required: false },
      { key: 'COST',          label: '교육 비용 (원)', type: 'number',   required: false },
      { key: 'PURPOSE',       label: '참가 목적',      type: 'textarea', required: true },
      { key: 'EFFECT',        label: '기대 효과',      type: 'textarea', required: false },
    ],
  },

  // ── 업무 ──────────────────────────────────────────
  {
    id: 'work_cooperation',
    category: 'work',
    categoryLabel: '업무',
    title: '업무협조 요청',
    docType: 'general',
    description: '타 부서·팀에 업무 협조를 공식 요청합니다.',
    body: `<h3>업무협조 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">요청 부서</td><td>{{REQ_DEPT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">협조 요청 부서</td><td>{{TARGET_DEPT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">협조 내용</td><td>{{CONTENT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">희망 완료일</td><td>{{DEADLINE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">협조 사유</td><td>{{REASON}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">담당자</td><td>{{CONTACT}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 업무 협조를 요청하오니 검토 후 회신하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'REQ_DEPT',    label: '요청 부서',          type: 'text',     required: true },
      { key: 'TARGET_DEPT', label: '협조 요청 부서',     type: 'text',     required: true },
      { key: 'CONTENT',     label: '협조 내용',          type: 'textarea', required: true },
      { key: 'DEADLINE',    label: '희망 완료일',        type: 'date',     required: false },
      { key: 'REASON',      label: '협조 사유',          type: 'textarea', required: true },
      { key: 'CONTACT',     label: '담당자 (연락처)',    type: 'text',     required: false },
    ],
  },
  {
    id: 'business_trip',
    category: 'work',
    categoryLabel: '업무',
    title: '출장신청',
    docType: 'business_trip',
    description: '국내외 출장 승인을 요청합니다.',
    body: `<h3>출장 신청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">출장지</td><td>{{DESTINATION}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">출장 목적</td><td>{{PURPOSE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">출장 기간</td><td>{{START_DATE}} ~ {{END_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">동행자</td><td>{{COMPANIONS}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">예상 교통비</td><td>{{TRANSPORT_COST}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">예상 숙박비</td><td>{{LODGING_COST}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">기타 경비</td><td>{{OTHER_COST}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">합계</td><td>{{TOTAL_COST}} 원</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 출장을 신청하오니 승인하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'DESTINATION',    label: '출장지',              type: 'text',   required: true },
      { key: 'PURPOSE',        label: '출장 목적',           type: 'textarea', required: true },
      { key: 'START_DATE',     label: '출장 시작일',         type: 'date',   required: true },
      { key: 'END_DATE',       label: '출장 종료일',         type: 'date',   required: true },
      { key: 'COMPANIONS',     label: '동행자',              type: 'text',   required: false },
      { key: 'TRANSPORT_COST', label: '교통비 (원)',         type: 'number', required: false },
      { key: 'LODGING_COST',   label: '숙박비 (원)',         type: 'number', required: false },
      { key: 'OTHER_COST',     label: '기타 경비 (원)',      type: 'number', required: false },
      { key: 'TOTAL_COST',     label: '합계 금액 (원)',      type: 'number', required: false },
    ],
  },
  {
    id: 'overtime_request',
    category: 'work',
    categoryLabel: '업무',
    title: '연장근무 신청',
    docType: 'overtime',
    description: '법정 근무시간 초과 연장근무를 신청합니다.',
    body: `<h3>연장근무 신청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">연장 날짜</td><td>{{OT_DATE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">연장 시간</td><td>{{OT_START}} ~ {{OT_END}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">연장 시간(합계)</td><td>{{OT_HOURS}} 시간</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">업무 내용</td><td>{{WORK_CONTENT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">연장 사유</td><td>{{REASON}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 연장근무를 신청하오니 승인하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'OT_DATE',       label: '연장 날짜',       type: 'date',     required: true },
      { key: 'OT_START',      label: '시작 시간',       type: 'text',     required: true },
      { key: 'OT_END',        label: '종료 시간',       type: 'text',     required: true },
      { key: 'OT_HOURS',      label: '합계 시간',       type: 'number',   required: false },
      { key: 'WORK_CONTENT',  label: '업무 내용',       type: 'textarea', required: true },
      { key: 'REASON',        label: '연장 사유',       type: 'textarea', required: true },
    ],
  },

  // ── 기획 ──────────────────────────────────────────
  {
    id: 'project_plan',
    category: 'planning',
    categoryLabel: '기획',
    title: '기획서 결재',
    docType: 'general',
    description: '신규 프로젝트·사업 계획의 승인을 요청합니다.',
    body: `<h3>기획서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">프로젝트명</td><td>{{PROJECT_NAME}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">추진 목적</td><td>{{PURPOSE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">추진 기간</td><td>{{PERIOD}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">예산</td><td>{{BUDGET}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">담당자</td><td>{{OWNER}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">주요 내용</td><td>{{MAIN_CONTENT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">기대 효과</td><td>{{EFFECT}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">리스크</td><td>{{RISK}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위 내용으로 추진 승인을 요청합니다.</p>`,
    placeholders: [
      { key: 'PROJECT_NAME',  label: '프로젝트명',   type: 'text',     required: true },
      { key: 'PURPOSE',       label: '추진 목적',    type: 'textarea', required: true },
      { key: 'PERIOD',        label: '추진 기간',    type: 'text',     required: true },
      { key: 'BUDGET',        label: '예산 (원)',    type: 'number',   required: false },
      { key: 'OWNER',         label: '담당자',       type: 'text',     required: true },
      { key: 'MAIN_CONTENT',  label: '주요 내용',   type: 'textarea', required: true },
      { key: 'EFFECT',        label: '기대 효과',   type: 'textarea', required: false },
      { key: 'RISK',          label: '리스크',      type: 'textarea', required: false },
    ],
  },
  {
    id: 'contract_approval',
    category: 'planning',
    categoryLabel: '기획',
    title: '계약체결 요청',
    docType: 'general',
    description: '외부 업체와의 계약 체결 승인을 요청합니다.',
    body: `<h3>계약체결 요청서</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">계약 상대방</td><td>{{COUNTERPARTY}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">계약 종류</td><td>{{CONTRACT_TYPE}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">계약 금액</td><td>{{AMOUNT}} 원</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">계약 기간</td><td>{{CONTRACT_PERIOD}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">주요 계약 내용</td><td>{{MAIN_TERMS}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">계약 필요 사유</td><td>{{REASON}}</td></tr>
</table>
<p style="margin-top:12px;font-size:12px;color:#666">위와 같이 계약 체결을 요청하오니 승인하여 주시기 바랍니다.</p>`,
    placeholders: [
      { key: 'COUNTERPARTY',   label: '계약 상대방',    type: 'text',     required: true },
      { key: 'CONTRACT_TYPE',  label: '계약 종류',      type: 'select',   options: ['용역계약', '물품구매계약', '임대차계약', 'MOU/협약', '파견계약', '기타'], required: true, defaultValue: '용역계약' },
      { key: 'AMOUNT',         label: '계약 금액 (원)', type: 'number',   required: false },
      { key: 'CONTRACT_PERIOD',label: '계약 기간',      type: 'text',     required: true },
      { key: 'MAIN_TERMS',     label: '주요 계약 내용', type: 'textarea', required: true },
      { key: 'REASON',         label: '계약 필요 사유', type: 'textarea', required: true },
    ],
  },

  // ── 일반 ──────────────────────────────────────────
  {
    id: 'work_report',
    category: 'general',
    categoryLabel: '일반',
    title: '업무 보고',
    docType: 'general',
    description: '주간/월간 업무 현황을 보고합니다.',
    body: `<h3>업무 보고</h3>
<table border="1" cellpadding="6" style="width:100%;border-collapse:collapse;font-size:13px">
  <tr><td style="background:#f5f5f5;width:30%;font-weight:bold">보고 기간</td><td>{{REPORT_PERIOD}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">주요 성과</td><td>{{ACHIEVEMENTS}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">진행 사항</td><td>{{IN_PROGRESS}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">주요 이슈</td><td>{{ISSUES}}</td></tr>
  <tr><td style="background:#f5f5f5;font-weight:bold">다음 계획</td><td>{{NEXT_PLAN}}</td></tr>
</table>`,
    placeholders: [
      { key: 'REPORT_PERIOD', label: '보고 기간',  type: 'text',     required: true },
      { key: 'ACHIEVEMENTS',  label: '주요 성과',  type: 'textarea', required: true },
      { key: 'IN_PROGRESS',   label: '진행 사항',  type: 'textarea', required: false },
      { key: 'ISSUES',        label: '주요 이슈',  type: 'textarea', required: false },
      { key: 'NEXT_PLAN',     label: '다음 계획',  type: 'textarea', required: false },
    ],
  },
  {
    id: 'general_free',
    category: 'general',
    categoryLabel: '일반',
    title: '일반 결재 (자유 양식)',
    docType: 'general',
    description: '정해진 양식 없이 자유롭게 작성합니다.',
    body: `<h3>결재 요청</h3><p>{{CONTENT}}</p>`,
    placeholders: [
      { key: 'CONTENT', label: '내용', type: 'textarea', required: true },
    ],
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'all',      label: '전체' },
  { id: 'purchase', label: '구매/재무' },
  { id: 'hr',       label: '인사' },
  { id: 'work',     label: '업무' },
  { id: 'planning', label: '기획' },
  { id: 'general',  label: '일반' },
] as const;
