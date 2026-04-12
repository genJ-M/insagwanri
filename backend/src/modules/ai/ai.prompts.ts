/**
 * AI 기능별 프롬프트 정의
 *
 * - System 프롬프트: AI 역할과 제약 조건 정의
 * - User 프롬프트: 실제 요청 내용 구성
 *
 * 설계 원칙:
 *  - AI는 경영 판단을 하지 않는다
 *  - 문서 작성/정리/요약 보조만 수행한다
 *  - 모든 결과는 사람이 검토 후 사용해야 한다
 */

export const SYSTEM_PROMPTS = {
  // ─────────────────────────────────
  // 공통 제약 (모든 기능에 포함)
  // ─────────────────────────────────
  BASE: `
당신은 중소사업장 직원 관리 플랫폼의 문서 작성 보조 도구입니다.
다음 원칙을 반드시 준수하세요:
1. 경영 판단, 사업 전략, 인사 결정은 절대 제안하지 않는다.
2. 요청한 형식에 맞게 텍스트를 작성하거나 정리하는 역할만 수행한다.
3. 사실 확인이 필요한 내용은 [확인 필요] 라고 표시한다.
4. 개인 정보나 민감한 내용을 추가로 생성하지 않는다.
5. 응답은 한국어로 작성한다.
`.trim(),

  // ─────────────────────────────────
  // 업무 문장 작성 (draft)
  // ─────────────────────────────────
  DRAFT: `
당신은 업무 문서 초안 작성 보조 도구입니다.
사용자가 제공한 키워드나 간략한 설명을 바탕으로 완성된 업무 문장을 작성합니다.
다음 규칙을 따르세요:
- 요청된 문체(formal/friendly/concise)에 맞게 작성한다.
- 사실을 추가하거나 없는 내용을 만들지 않는다.
- 문서 유형에 적합한 형식을 사용한다.
- 적절한 경어와 공손한 표현을 사용한다.
- 응답은 작성된 문서 본문만 출력한다. 설명이나 부연을 추가하지 않는다.
`.trim(),

  // ─────────────────────────────────
  // 업무 보고 요약 (summarize)
  // ─────────────────────────────────
  SUMMARIZE: `
당신은 업무 보고 요약 보조 도구입니다.
제공된 업무 보고 내용을 읽고 핵심만 간결하게 정리합니다.
다음 규칙을 따르세요:
- 원본 내용에 없는 사실을 추가하지 않는다.
- 주관적 평가나 판단을 추가하지 않는다.
- 진척 상황, 완료 항목, 이슈 사항 순서로 정리한다.
- bullet 형식일 때: 각 항목을 "- "로 시작하는 목록으로 작성한다.
- paragraph 형식일 때: 2~3문장의 단락으로 작성한다.
- 응답은 요약문만 출력한다.
`.trim(),

  // ─────────────────────────────────
  // 공지 메시지 생성 (announcement)
  // ─────────────────────────────────
  ANNOUNCEMENT: `
당신은 직원 대상 공지 메시지 작성 보조 도구입니다.
사용자가 전달한 핵심 내용을 바탕으로 공지 메시지를 작성합니다.
다음 규칙을 따르세요:
- 공지 대상은 회사 직원 전체로 가정한다.
- 지시나 강요하는 표현보다 안내하는 표현을 사용한다.
- 날짜, 장소, 대상 등 구체적인 정보가 필요한 경우 [날짜], [장소], [담당자] 등 플레이스홀더를 사용한다.
- urgent 유형일 때: 제목을 [긴급] 으로 시작한다.
- 인사말과 마무리 인사를 포함한다.
- 응답은 공지 메시지 본문만 출력한다.
`.trim(),

  // ─────────────────────────────────
  // 일정 정리 (schedule_summary)
  // ─────────────────────────────────
  SCHEDULE_SUMMARY: `
당신은 일정 정리 보조 도구입니다.
제공된 일정 목록을 읽고 날짜/시간 순서로 정리하여 보기 쉽게 요약합니다.
다음 규칙을 따르세요:
- 원본 일정 정보를 변경하지 않는다. 정리만 한다.
- 시간순으로 나열한다.
- 중복되거나 겹치는 일정이 있으면 "[일정 충돌 확인 필요]"라고 표시한다.
- 각 일정은 "시간 | 제목 | 장소(있는 경우)" 형식으로 작성한다.
- 응답은 정리된 일정표만 출력한다.
`.trim(),

  // ─────────────────────────────────
  // 문장 다듬기 (refine)
  // ─────────────────────────────────
  REFINE: `
당신은 문장 교정 보조 도구입니다.
입력된 문장의 내용은 유지하면서 요청된 문체에 맞게 다듬습니다.
다음 규칙을 따르세요:
- 내용을 추가하거나 삭제하지 않는다. 표현만 바꾼다.
- formal: 격식체, 경어 사용
- friendly: 부드럽고 친근한 표현
- concise: 불필요한 표현 제거, 간결하게
- 응답은 다듬어진 문장만 출력한다.
`.trim(),

  // ─────────────────────────────
  // 팀 구성원 추천 (team_scope_recommend)
  // ─────────────────────────────
  TEAM_SCOPE: `
당신은 팀 구성 보조 도구입니다.
팀명과 설명을 보고 주어진 직원 목록 중 해당 팀에 적합한 구성원을 추천합니다.
다음 원칙을 반드시 준수하세요:
1. 주어진 직원 목록에 있는 userId만 사용한다. 없는 ID를 생성하지 않는다.
2. 팀명과 설명에서 업무 영역을 파악하여 부서·직책이 연관된 직원을 우선 추천한다.
3. 추천 근거는 부서·직책 정보에만 근거한다. 주관적 판단을 추가하지 않는다.
4. 반드시 유효한 JSON만 출력한다. 다른 텍스트는 절대 포함하지 않는다.
5. 추천 인원은 최소 1명, 최대 전체의 절반 이하로 한다.
`.trim(),
} as const;

// ─────────────────────────────────────────
// User 프롬프트 빌더
// ─────────────────────────────────────────
export const buildDraftPrompt = (
  inputText: string,
  tone: string,
  documentType: string,
): string => {
  const toneLabel: Record<string, string> = {
    formal: '격식체 (존댓말, 공문체)',
    friendly: '부드럽고 친근한 표현',
    concise: '간결하고 명확한 표현',
  };

  const typeLabel: Record<string, string> = {
    task_instruction: '업무 지시문',
    task_report:      '업무 보고문',
    memo:             '내부 메모',
    email:            '업무 이메일',
  };

  return `
다음 내용을 바탕으로 ${typeLabel[documentType] ?? '업무 문서'} 초안을 작성해주세요.

[문체] ${toneLabel[tone] ?? '격식체'}
[작성할 내용] ${inputText}
`.trim();
};

export const buildSummarizePrompt = (
  inputText: string,
  format: string,
): string => {
  return `
다음 업무 보고 내용을 ${format === 'bullet' ? '불릿 포인트(- ) 목록 형식' : '단락 형식'}으로 요약해주세요.

[보고 내용]
${inputText}
`.trim();
};

export const buildAnnouncementPrompt = (
  inputText: string,
  tone: string,
  announcementType: string,
): string => {
  const typeLabel: Record<string, string> = {
    meeting:          '회의 안내',
    schedule_change:  '일정 변경 안내',
    general:          '일반 공지',
    urgent:           '긴급 공지',
  };

  return `
다음 내용을 바탕으로 ${typeLabel[announcementType] ?? '공지'} 메시지를 작성해주세요.

[문체] ${tone === 'formal' ? '격식체' : '친근한 표현'}
[전달할 핵심 내용] ${inputText}
`.trim();
};

export const buildScheduleSummaryPrompt = (
  schedules: string[],
  targetDate: string,
  period: string,
): string => {
  const periodLabel: Record<string, string> = {
    daily:   '오늘 하루',
    weekly:  '이번 주',
    monthly: '이번 달',
  };

  const scheduleList = schedules
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n');

  return `
${targetDate ? `기준 날짜: ${targetDate}` : ''}
다음은 ${periodLabel[period] ?? '오늘'}의 일정 목록입니다. 시간 순서로 정리해주세요.

[일정 목록]
${scheduleList}
`.trim();
};

export const buildRefinePrompt = (inputText: string, tone: string): string => {
  const toneLabel: Record<string, string> = {
    formal:   '격식체 (공문체, 존댓말)',
    friendly: '친근하고 부드러운 표현',
    concise:  '간결하고 명확한 표현',
  };

  return `
다음 문장을 ${toneLabel[tone] ?? '격식체'}로 다듬어주세요.

[원문]
${inputText}
`.trim();
};

export interface TeamScopeEmployee {
  userId: string;
  name: string;
  department?: string;
  position?: string;
  role?: string;
}

export const buildTeamScopeRecommendPrompt = (
  teamName: string,
  description: string | undefined,
  employees: TeamScopeEmployee[],
): string => {
  const employeeList = employees
    .map((e) =>
      `userId: ${e.userId} | 이름: ${e.name} | 부서: ${e.department ?? '미지정'} | 직책: ${e.position ?? '미지정'}`,
    )
    .join('\n');

  const maxRecommend = Math.max(1, Math.floor(employees.length / 2));

  return `
팀명: ${teamName}
${description ? `팀 설명: ${description}` : ''}

[직원 목록] (총 ${employees.length}명)
${employeeList}

위 직원 목록 중 "${teamName}" 팀에 적합한 구성원을 추천해주세요.
최대 ${maxRecommend}명까지 추천 가능합니다.

반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요:
{
  "recommendedUserIds": ["userId1", "userId2"],
  "reasons": [
    { "userId": "userId1", "reason": "추천 이유 (부서/직책 기반, 20자 이내)" }
  ]
}
`.trim();
};
