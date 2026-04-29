import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { TournamentService } from './tournament.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

class CreateBlastLobbyDto {
  @IsNumber()
  @IsPositive()
  @Min(500)
  @Type(() => Number)
  buyin: number;

  @IsOptional()
  @IsString()
  password?: string;
}

@ApiTags('Tournament')
@Controller('rooms')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  // ─── Blast Phase 1 Endpoints ───────────────────────────────────────────────

  /**
   * POST /rooms/blast
   * Create a new Blast lobby and add it to the Redis waiting queue.
   * The lobby creator is automatically joined as the first player.
   */
  @Post('blast')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new Blast lobby' })
  async createBlastLobby(
    @Body() dto: CreateBlastLobbyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const lobby = await this.tournamentService.createBlastLobby(
      dto.buyin,
      req.user.userId,
      dto.password,
    );
    return lobby;
  }

  /**
   * GET /rooms/blast/lobbies
   * Returns all waiting Blast lobbies from the Redis queue.
   */
  @Get('blast/lobbies')
  @ApiOperation({ summary: 'List all waiting Blast lobbies' })
  async getBlastLobbies() {
    return this.tournamentService.getBlastLobbies();
  }

  /**
   * POST /rooms/blast/:id/join
   * Join an existing Blast lobby. Fails if the lobby is full,
   * already started, player has already joined, or wrong password.
   */
  @Post('blast/:id/join')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a Blast lobby' })
  async joinBlastLobby(
    @Param('id') lobbyId: string,
    @Body('password') password: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.tournamentService.joinBlastLobby(
      lobbyId,
      req.user.userId,
      password,
    );
    if (!result) {
      throw new BadRequestException(
        'Lobby is full, already started, player already joined, or invalid password',
      );
    }
    return result;
  }

  /**
   * GET /rooms/blast/:id
   * Returns the current state of a specific Blast lobby.
   */
  @Get('blast/:id')
  @ApiOperation({ summary: 'Get a specific Blast lobby' })
  async getBlastLobby(@Param('id') lobbyId: string) {
    const lobby = await this.tournamentService.getBlastLobby(lobbyId);
    if (!lobby) {
      throw new NotFoundException('Blast lobby not found');
    }
    return lobby;
  }

  // ─── Existing Endpoint ─────────────────────────────────────────────────────

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
