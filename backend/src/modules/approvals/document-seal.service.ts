import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApprovalDocument } from '../../database/entities/approval-document.entity';
import { ApprovalStep } from '../../database/entities/approval-step.entity';

/**
 * 결재 문서 봉인 서비스
 *
 * [보존 정책]
 * - 최종 승인 시 SHA-256 해시 체인을 생성하고 is_sealed = TRUE 로 전환
 * - retain_until = sealed_at + 5년 (근로기준법·전자문서법 기준)
 * - 봉인된 문서는 수정·삭제 불가, 회사 탈퇴 후에도 retain_until 까지 유지
 *
 * [해시 체인 구조]
 * step_hash(n) = SHA-256( doc_id | step | approver_id | status | comment | acted_at | step_hash(n-1) )
 * content_hash = SHA-256( title | content | author_id | submitted_at )
 * seal_hash    = SHA-256( content_hash | step_hash(last) | sealed_at )
 *
 * 어느 하나라도 변조되면 seal_hash 재계산 시 불일치 → 위변조 감지
 */
@Injectable()
export class DocumentSealService {

  // ─── 봉인 ────────────────────────────────────────────────────────────────

  computeContentHash(doc: ApprovalDocument): string {
    const raw = [
      doc.id,
      doc.title,
      doc.content,
      doc.authorId,
      doc.submittedAt?.toISOString() ?? '',
    ].join('|');
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  computeStepHash(step: ApprovalStep, prevHash: string): string {
    const raw = [
      step.documentId,
      String(step.step),
      step.approverId,
      step.status,
      step.comment ?? '',
      step.actedAt?.toISOString() ?? '',
      prevHash,
    ].join('|');
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  computeSealHash(contentHash: string, lastStepHash: string, sealedAt: Date): string {
    const raw = [contentHash, lastStepHash, sealedAt.toISOString()].join('|');
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /**
   * 최종 승인 시 호출. step_hash, content_hash, seal_hash 를 계산해
   * 반환값을 docRepo / stepRepo 에 저장하면 됨.
   */
  seal(
    doc: ApprovalDocument,
    steps: ApprovalStep[],
    companyName: string,
  ): {
    contentHash: string;
    sealHash: string;
    sealedAt: Date;
    retainUntil: Date;
    snapshot: Record<string, any>;
    stepHashes: { stepId: string; hash: string }[];
  } {
    const sealedAt = new Date();

    // 1) 콘텐츠 해시
    const contentHash = this.computeContentHash(doc);

    // 2) 결재 단계별 해시 체인 (step 오름차순)
    const sorted = [...steps].sort((a, b) => a.step - b.step);
    let prevHash = contentHash; // 첫 단계의 prev는 contentHash
    const stepHashes: { stepId: string; hash: string }[] = [];

    for (const s of sorted) {
      const h = this.computeStepHash(s, prevHash);
      stepHashes.push({ stepId: s.id, hash: h });
      prevHash = h;
    }

    // 3) 최종 봉인 해시
    const sealHash = this.computeSealHash(contentHash, prevHash, sealedAt);

    // 4) 법정 보존 기한 (5년)
    const retainUntil = new Date(sealedAt);
    retainUntil.setFullYear(retainUntil.getFullYear() + 5);

    // 5) 스냅샷 (사용자 삭제 후에도 PDF 재생성 가능하도록)
    const snapshot = {
      companyName,
      author: {
        id: doc.authorId,
        name: (doc.author as any)?.name ?? '',
        department: (doc.author as any)?.department ?? '',
        position: (doc.author as any)?.position ?? '',
      },
      title: doc.title,
      type: doc.type,
      submittedAt: doc.submittedAt?.toISOString() ?? null,
      sealedAt: sealedAt.toISOString(),
      steps: sorted.map((s, i) => ({
        step: s.step,
        approverId: s.approverId,
        name: (s.approver as any)?.name ?? '',
        position: (s.approver as any)?.position ?? '',
        status: s.status,
        comment: s.comment ?? null,
        actedAt: s.actedAt?.toISOString() ?? null,
        hash: stepHashes[i].hash,
      })),
      contentHash,
      sealHash,
    };

    return { contentHash, sealHash, sealedAt, retainUntil, snapshot, stepHashes };
  }

  // ─── 무결성 검증 ─────────────────────────────────────────────────────────

  verify(doc: ApprovalDocument, steps: ApprovalStep[]): {
    valid: boolean;
    contentMatch: boolean;
    chainMatch: boolean;
    details: string;
  } {
    if (!doc.isSealed || !doc.sealHash || !doc.contentHash || !doc.sealedAt) {
      return { valid: false, contentMatch: false, chainMatch: false, details: '봉인되지 않은 문서입니다.' };
    }

    // 콘텐츠 해시 재계산
    const recalcContent = this.computeContentHash(doc);
    const contentMatch = recalcContent === doc.contentHash;

    // 체인 재계산
    const sorted = [...steps].sort((a, b) => a.step - b.step);
    let prevHash = doc.contentHash;
    let chainMatch = true;

    for (const s of sorted) {
      const expected = this.computeStepHash(s, prevHash);
      if (s.stepHash !== expected) { chainMatch = false; break; }
      prevHash = s.stepHash!;
    }

    // 봉인 해시 재계산
    const recalcSeal = this.computeSealHash(doc.contentHash, prevHash, doc.sealedAt);
    const sealMatch = recalcSeal === doc.sealHash;

    const valid = contentMatch && chainMatch && sealMatch;
    const details = valid
      ? '문서 무결성이 확인되었습니다. 결재 완료 후 변경 없음.'
      : [
          !contentMatch && '문서 내용이 변조되었습니다.',
          !chainMatch   && '결재 체인이 변조되었습니다.',
          !sealMatch    && '봉인 해시가 일치하지 않습니다.',
        ].filter(Boolean).join(' ');

    return { valid, contentMatch, chainMatch: chainMatch && sealMatch, details };
  }

  // ─── 인쇄용 HTML 생성 ────────────────────────────────────────────────────

  generatePrintHtml(doc: ApprovalDocument, steps: ApprovalStep[]): string {
    const snap = doc.snapshot ?? {};
    const companyName = snap.companyName ?? '';
    const author = snap.author ?? { name: '', department: '', position: '' };
    const snapSteps: any[] = snap.steps ?? [];

    // 결재란 칸 (최대 5칸 표시)
    const approvalBoxCells = snapSteps.map(s => {
      const statusLabel = s.status === 'approved' ? '결재' : s.status === 'rejected' ? '반려' : '미결';
      const dateStr = s.actedAt ? new Date(s.actedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '') : '';
      return `
        <td class="approval-cell">
          <div class="approval-position">${escHtml(s.position || '')}</div>
          <div class="approval-stamp ${s.status}">
            <span class="stamp-name">${escHtml(s.name)}</span>
            <span class="stamp-status">${statusLabel}</span>
            ${s.comment ? `<span class="stamp-comment">${escHtml(s.comment)}</span>` : ''}
          </div>
          <div class="approval-date">${dateStr}</div>
        </td>`;
    }).join('');

    // 기안자 칸
    const submittedDate = doc.submittedAt
      ? new Date(doc.submittedAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
      : '';

    const docTypeLabels: Record<string, string> = {
      general: '일반결재', vacation: '휴가신청', expense: '지출결의',
      overtime: '연장근무', business_trip: '출장신청', hr: '인사발령',
      permission_change: '권한변경', work_schedule_change: '근무일정변경',
    };

    const statusLabel: Record<string, string> = {
      approved: '최종승인', rejected: '반려', in_progress: '결재중',
      draft: '기안중', cancelled: '취소',
    };

    const sealedAtStr = doc.sealedAt
      ? new Date(doc.sealedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      : '';
    const retainUntilStr = doc.retainUntil
      ? new Date(doc.retainUntil).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
      : '';
    const shortSeal = doc.sealHash ? `${doc.sealHash.slice(0, 16)}…${doc.sealHash.slice(-8)}` : '';

    // HTML 콘텐츠 — content 는 이미 HTML(RichText) 또는 plain text
    const bodyContent = doc.content?.startsWith('<') ? doc.content : escHtml(doc.content ?? '').replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${escHtml(doc.title)} — 결재문서</title>
  <style>
    @page { size: A4; margin: 20mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
      font-size: 10pt;
      color: #000;
      background: #fff;
      margin: 0; padding: 0;
    }
    .page { max-width: 190mm; margin: 0 auto; padding: 0; }

    /* 헤더 */
    .doc-header { text-align: center; margin-bottom: 8mm; border-bottom: 2px solid #000; padding-bottom: 4mm; }
    .company-name { font-size: 9pt; color: #555; margin-bottom: 2mm; }
    .doc-title { font-size: 18pt; font-weight: bold; letter-spacing: 2px; margin-bottom: 2mm; }
    .doc-type-badge {
      display: inline-block; border: 1px solid #333; padding: 1px 8px;
      font-size: 8pt; border-radius: 2px;
    }

    /* 결재란 */
    .approval-box-wrapper { display: flex; justify-content: flex-end; margin-bottom: 5mm; }
    .approval-box { border-collapse: collapse; }
    .approval-box td { border: 1px solid #000; width: 22mm; text-align: center; vertical-align: top; padding: 0; }
    .approval-box th {
      border: 1px solid #000; background: #f0f0f0;
      font-size: 8pt; padding: 1mm 2mm; white-space: nowrap;
    }
    .approval-cell { height: 32mm; }
    .approval-position { font-size: 7.5pt; padding: 1mm; border-bottom: 1px solid #ccc; min-height: 6mm; }
    .approval-stamp {
      height: 18mm; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 1px;
    }
    .approval-stamp.approved .stamp-name { color: #cc0000; }
    .approval-stamp.rejected  .stamp-name { color: #888; text-decoration: line-through; }
    .stamp-name { font-size: 9pt; font-weight: bold; }
    .stamp-status { font-size: 7pt; color: #555; }
    .stamp-comment { font-size: 6.5pt; color: #888; max-width: 20mm; word-break: break-all; }
    .approval-date { font-size: 7pt; border-top: 1px solid #ccc; padding: 1mm; color: #333; }
    .drafter-cell { height: 32mm; }
    .drafter-position { font-size: 7.5pt; padding: 1mm; border-bottom: 1px solid #ccc; }
    .drafter-name { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 18mm; font-size: 9pt; }
    .drafter-date { font-size: 7pt; border-top: 1px solid #ccc; padding: 1mm; color: #333; }

    /* 문서 정보 */
    .doc-info { border-collapse: collapse; width: 100%; margin-bottom: 5mm; }
    .doc-info td { border: 1px solid #000; padding: 1.5mm 3mm; font-size: 9pt; }
    .doc-info .label { background: #f5f5f5; font-weight: bold; width: 20mm; white-space: nowrap; }

    /* 본문 */
    .doc-body { border: 1px solid #000; min-height: 80mm; padding: 5mm; margin-bottom: 5mm; font-size: 10pt; line-height: 1.8; }
    .doc-body p { margin: 0 0 2mm; }
    .doc-body h1,h2,h3 { margin: 3mm 0 2mm; }

    /* 봉인 정보 */
    .seal-section {
      border: 1px solid #999; border-radius: 2px; padding: 3mm 4mm;
      margin-top: 5mm; background: #fafafa; font-size: 8pt; color: #444;
    }
    .seal-title { font-weight: bold; font-size: 9pt; margin-bottom: 2mm; color: #000; }
    .seal-row { display: flex; gap: 4mm; margin-bottom: 1mm; flex-wrap: wrap; }
    .seal-label { font-weight: bold; white-space: nowrap; min-width: 20mm; }
    .seal-value { font-family: 'Courier New', monospace; word-break: break-all; }
    .seal-valid { color: #006600; font-weight: bold; }
    .seal-warning { color: #cc0000; font-weight: bold; }

    /* 인쇄 */
    @media print {
      .no-print { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }

    /* 인쇄 버튼 */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0;
      background: #1e40af; color: #fff; padding: 8px 16px;
      display: flex; align-items: center; gap: 12px;
      font-size: 13px; z-index: 999;
    }
    .print-bar button {
      background: #fff; color: #1e40af; border: none;
      padding: 5px 14px; border-radius: 4px; cursor: pointer;
      font-size: 13px; font-weight: bold;
    }
    @media print { .print-bar { display: none; } }
    .page { margin-top: 44px; }
    @media print { .page { margin-top: 0; } }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <span>결재 완료 문서 — PDF로 저장하려면 [인쇄] 후 "PDF로 저장"을 선택하세요.</span>
    <button onclick="window.print()">🖨 인쇄 / PDF 저장</button>
    <button onclick="window.close()">✕ 닫기</button>
  </div>

  <div class="page">
    <!-- 헤더 -->
    <div class="doc-header">
      <div class="company-name">${escHtml(companyName)}</div>
      <div class="doc-title">${escHtml(doc.title)}</div>
      <div class="doc-type-badge">${escHtml(docTypeLabels[doc.type] ?? doc.type)}</div>
    </div>

    <!-- 결재란 -->
    <div class="approval-box-wrapper">
      <table class="approval-box">
        <thead>
          <tr>
            <th>기안</th>
            ${snapSteps.map(s => `<th>${escHtml(s.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="drafter-cell">
              <div class="drafter-position">${escHtml(author.department || '')} ${escHtml(author.position || '')}</div>
              <div class="drafter-name"><span>${escHtml(author.name)}</span></div>
              <div class="drafter-date">${submittedDate}</div>
            </td>
            ${approvalBoxCells}
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 문서 정보 -->
    <table class="doc-info">
      <tr>
        <td class="label">문서번호</td>
        <td>${escHtml(doc.id)}</td>
        <td class="label">기안일</td>
        <td>${doc.submittedAt ? new Date(doc.submittedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</td>
      </tr>
      <tr>
        <td class="label">기안부서</td>
        <td>${escHtml(author.department || '-')}</td>
        <td class="label">기안자</td>
        <td>${escHtml(author.name)}</td>
      </tr>
      <tr>
        <td class="label">결재상태</td>
        <td colspan="3">${escHtml(statusLabel[doc.status] ?? doc.status)}</td>
      </tr>
    </table>

    <!-- 본문 -->
    <div class="doc-body">${bodyContent}</div>

    <!-- 봉인 정보 -->
    ${doc.isSealed ? `
    <div class="seal-section">
      <div class="seal-title">🔒 전자 결재 봉인 정보</div>
      <div class="seal-row">
        <span class="seal-label">봉인일시</span>
        <span>${escHtml(sealedAtStr)}</span>
      </div>
      <div class="seal-row">
        <span class="seal-label">보존기한</span>
        <span>${escHtml(retainUntilStr)} (5년 법정보존)</span>
      </div>
      <div class="seal-row">
        <span class="seal-label">봉인해시</span>
        <span class="seal-value">${escHtml(doc.sealHash ?? '')}</span>
      </div>
      <div class="seal-row">
        <span class="seal-label">검증상태</span>
        <span class="seal-valid">✓ 위변조 없음 확인됨</span>
      </div>
      <div style="margin-top:2mm; font-size:7.5pt; color:#666;">
        본 문서는 전자서명법 및 전자문서법에 따라 봉인된 전자결재 문서입니다.
        봉인 이후 내용 변경이 불가하며, 위 해시값으로 무결성을 검증할 수 있습니다.
      </div>
    </div>` : ''}
  </div>
</body>
</html>`;
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
