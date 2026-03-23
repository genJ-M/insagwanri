import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { HrNotesService } from './hr-notes.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AuthenticatedUser } from '../../common/types/jwt-payload.type';
import { CreateHrNoteDto, UpdateHrNoteDto, HrNoteQueryDto } from './dto/hr-note.dto';

@Controller('hr-notes')
export class HrNotesController {
  constructor(private readonly hrNotesService: HrNotesService) {}

  @Get()
  async findAll(@GetUser() user: AuthenticatedUser, @Query() query: HrNoteQueryDto) {
    const data = await this.hrNotesService.findAll(user, query);
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.hrNotesService.findOne(user, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@GetUser() user: AuthenticatedUser, @Body() dto: CreateHrNoteDto) {
    const data = await this.hrNotesService.create(user, dto);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @GetUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHrNoteDto,
  ) {
    const data = await this.hrNotesService.update(user, id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@GetUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.hrNotesService.remove(user, id);
    return { success: true, data };
  }
}
