import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('rooms')
@ApiTags('Tournament')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Get(':id/prizes')
  @ApiOperation({ summary: 'Get tournament prize distribution for a room' })
  async getPrizes(@Param('id') roomId: string) {
    const prizes = await this.tournamentService.getPrizeDistribution(roomId);
    if (!prizes) {
      throw new NotFoundException(
        'Tournament room not found or not a tournament',
      );
    }
    return prizes;
  }
}
