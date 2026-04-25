import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TournamentScheduleService } from './tournament-schedule.service';
import {
  CreateScheduleDto,
  ScheduleEntryResponseDto,
  ScheduleListResponseDto,
  TournamentScheduleStatus,
  UpcomingTournamentsResponseDto,
  ListSchedulesQueryDto,
} from './dto/schedule.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Server } from 'socket.io';
import { AppGateway } from '../websocket/app.gateway';

@Controller('tournament-schedule')
@ApiTags('Tournament Schedule')
@ApiBearerAuth()
export class TournamentScheduleController {
  constructor(
    private readonly scheduleService: TournamentScheduleService,
    private readonly appGateway: AppGateway,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tournament schedule entry' })
  async createSchedule(
    @Body() dto: CreateScheduleDto,
  ): Promise<ScheduleEntryResponseDto> {
    return this.scheduleService.createSchedule(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tournament schedule entries' })
  async listSchedules(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ): Promise<ScheduleListResponseDto> {
    const query: ListSchedulesQueryDto = {
      type: type as any,
      status: status as any,
      page,
      limit,
    };
    return this.scheduleService.listSchedules(query);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming tournaments for calendar display' })
  async getUpcomingTournaments(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ): Promise<UpcomingTournamentsResponseDto> {
    return this.scheduleService.getUpcomingTournaments(limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tournament schedule entry by ID' })
  async getSchedule(
    @Param('id') id: string,
  ): Promise<ScheduleEntryResponseDto> {
    return this.scheduleService.getSchedule(id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a scheduled tournament' })
  async startTournament(
    @Param('id') id: string,
  ): Promise<ScheduleEntryResponseDto> {
    return this.scheduleService.startTournament(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a tournament as completed' })
  async completeTournament(
    @Param('id') id: string,
  ): Promise<ScheduleEntryResponseDto> {
    return this.scheduleService.completeTournament(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a scheduled tournament' })
  async cancelSchedule(
    @Param('id') id: string,
  ): Promise<ScheduleEntryResponseDto> {
    return this.scheduleService.cancelSchedule(id);
  }

  @Post(':id/reminder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Emit a reminder for a scheduled tournament' })
  async emitReminder(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.scheduleService.emitReminder(id);
    return { success: true };
  }
}
