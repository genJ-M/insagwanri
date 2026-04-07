import { Controller, Post, Body, Req } from '@nestjs/common';
import { FeedbackService, CreateFeedbackDto } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateFeedbackDto) {
    const user = req.user;
    return this.feedbackService.create(
      user?.userId ?? null,
      user?.companyId ?? null,
      dto,
    );
  }
}
