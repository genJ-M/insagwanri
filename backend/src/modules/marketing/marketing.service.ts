import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UpsertBlockDto, CreateBannerDto, UpdateBannerDto, CreatePopupDto, UpdatePopupDto } from './dto/marketing.dto';

@Injectable()
export class MarketingService {
  constructor(
    @InjectDataSource()
    private readonly db: DataSource,
  ) {}

  // ── Blocks ────────────────────────────────────────────────────

  async getAllBlocks(): Promise<Record<string, Record<string, string>>> {
    const rows = await this.db.query(
      `SELECT section, key, value FROM marketing_blocks ORDER BY section, key`,
    );
    const result: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      if (!result[row.section]) result[row.section] = {};
      result[row.section][row.key] = row.value;
    }
    return result;
  }

  async getSection(section: string): Promise<Record<string, string>> {
    const rows = await this.db.query(
      `SELECT key, value FROM marketing_blocks WHERE section = $1 ORDER BY key`,
      [section],
    );
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  async upsertBlock(dto: UpsertBlockDto) {
    await this.db.query(
      `INSERT INTO marketing_blocks (section, key, label, value, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (section, key) DO UPDATE
         SET value = EXCLUDED.value,
             label = COALESCE(EXCLUDED.label, marketing_blocks.label),
             updated_at = NOW()`,
      [dto.section, dto.key, dto.label ?? '', dto.value],
    );
    return { success: true };
  }

  async bulkUpsertBlocks(blocks: UpsertBlockDto[]) {
    if (!blocks.length) return { updated: 0 };
    for (const b of blocks) await this.upsertBlock(b);
    return { updated: blocks.length };
  }

  // ── Banners ───────────────────────────────────────────────────

  async listBanners() {
    return this.db.query(
      `SELECT * FROM marketing_banners ORDER BY created_at DESC`,
    );
  }

  async getActiveBanner() {
    const now = new Date().toISOString();
    const rows = await this.db.query(
      `SELECT * FROM marketing_banners
       WHERE is_active = TRUE
         AND (starts_at IS NULL OR starts_at <= $1)
         AND (ends_at IS NULL OR ends_at >= $1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [now],
    );
    return rows[0] ?? null;
  }

  async createBanner(dto: CreateBannerDto) {
    const [row] = await this.db.query(
      `INSERT INTO marketing_banners
         (text, link_url, link_text, bg_color, text_color, is_active, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        dto.text,
        dto.linkUrl ?? null,
        dto.linkText ?? null,
        dto.bgColor ?? '#1d4ed8',
        dto.textColor ?? '#ffffff',
        dto.isActive ?? false,
        dto.startsAt ?? null,
        dto.endsAt ?? null,
      ],
    );
    return row;
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (dto.text      !== undefined) { fields.push(`text = $${i++}`);       params.push(dto.text); }
    if (dto.linkUrl   !== undefined) { fields.push(`link_url = $${i++}`);   params.push(dto.linkUrl); }
    if (dto.linkText  !== undefined) { fields.push(`link_text = $${i++}`);  params.push(dto.linkText); }
    if (dto.bgColor   !== undefined) { fields.push(`bg_color = $${i++}`);   params.push(dto.bgColor); }
    if (dto.textColor !== undefined) { fields.push(`text_color = $${i++}`); params.push(dto.textColor); }
    if (dto.isActive  !== undefined) { fields.push(`is_active = $${i++}`);  params.push(dto.isActive); }
    if (dto.startsAt  !== undefined) { fields.push(`starts_at = $${i++}`);  params.push(dto.startsAt); }
    if (dto.endsAt    !== undefined) { fields.push(`ends_at = $${i++}`);    params.push(dto.endsAt); }
    if (!fields.length) return this.getBanner(id);
    fields.push(`updated_at = NOW()`);
    params.push(id);
    const [row] = await this.db.query(
      `UPDATE marketing_banners SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (!row) throw new NotFoundException('배너를 찾을 수 없습니다.');
    return row;
  }

  async deleteBanner(id: string) {
    await this.db.query(`DELETE FROM marketing_banners WHERE id = $1`, [id]);
    return { success: true };
  }

  private async getBanner(id: string) {
    const [row] = await this.db.query(
      `SELECT * FROM marketing_banners WHERE id = $1`, [id],
    );
    if (!row) throw new NotFoundException('배너를 찾을 수 없습니다.');
    return row;
  }

  // ── Popups ────────────────────────────────────────────────────

  async listPopups() {
    return this.db.query(`SELECT * FROM marketing_popups ORDER BY created_at DESC`);
  }

  async getActivePopups() {
    const now = new Date().toISOString();
    return this.db.query(
      `SELECT * FROM marketing_popups
       WHERE is_active = TRUE
         AND (starts_at IS NULL OR starts_at <= $1)
         AND (ends_at IS NULL OR ends_at >= $1)
       ORDER BY created_at DESC`,
      [now],
    );
  }

  async createPopup(dto: CreatePopupDto) {
    const [row] = await this.db.query(
      `INSERT INTO marketing_popups
         (name, title, body, cta_text, cta_url, trigger_type, trigger_value,
          target, dismiss_days, is_active, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        dto.name, dto.title, dto.body,
        dto.ctaText ?? null, dto.ctaUrl ?? null,
        dto.triggerType ?? 'immediate', dto.triggerValue ?? 0,
        dto.target ?? 'all', dto.dismissDays ?? 7,
        dto.isActive ?? false,
        dto.startsAt ?? null, dto.endsAt ?? null,
      ],
    );
    return row;
  }

  async updatePopup(id: string, dto: UpdatePopupDto) {
    const map: Record<string, string> = {
      name: 'name', title: 'title', body: 'body',
      ctaText: 'cta_text', ctaUrl: 'cta_url',
      triggerType: 'trigger_type', triggerValue: 'trigger_value',
      target: 'target', dismissDays: 'dismiss_days',
      isActive: 'is_active', startsAt: 'starts_at', endsAt: 'ends_at',
    };
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [dtoKey, col] of Object.entries(map)) {
      const val = (dto as Record<string, unknown>)[dtoKey];
      if (val !== undefined) { fields.push(`${col} = $${i++}`); params.push(val); }
    }
    if (!fields.length) return this.getPopup(id);
    fields.push(`updated_at = NOW()`);
    params.push(id);
    const [row] = await this.db.query(
      `UPDATE marketing_popups SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (!row) throw new NotFoundException('팝업을 찾을 수 없습니다.');
    return row;
  }

  async deletePopup(id: string) {
    await this.db.query(`DELETE FROM marketing_popups WHERE id = $1`, [id]);
    return { success: true };
  }

  private async getPopup(id: string) {
    const [row] = await this.db.query(
      `SELECT * FROM marketing_popups WHERE id = $1`, [id],
    );
    if (!row) throw new NotFoundException('팝업을 찾을 수 없습니다.');
    return row;
  }
}
