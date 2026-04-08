import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { CustomTemplatesService } from './custom-templates.service';
import {
  CreateCustomTemplateDto, UpdateCustomTemplateDto, CustomTemplateQueryDto,
} from './dto/custom-templates.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';

@Controller('custom-templates')
export class CustomTemplatesController {
  constructor(private readonly svc: CustomTemplatesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: CustomTemplateQueryDto) {
    return this.svc.findAll(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomTemplateDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomTemplateDto,
  ) {
    return this.svc.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(user, id);
  }

  @Post(':id/use')
  incrementUse(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.incrementUse(user, id);
  }
}
