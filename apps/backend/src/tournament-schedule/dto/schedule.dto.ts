import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TournamentType } from '@texas/shared/types/tournament';

/** Request DTO for creating a BTC tournament schedule entry */
export class CreateScheduleDto {
  @ApiProperty({ description: 'Tournament name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Tournament type (BTC/SNG/MTT)' })
  @IsEnum(TournamentType)
  type: TournamentType;

  @ApiProperty({ description: 'Buy-in amount in chips' })
  @IsInt()
  @Min(0)
  buyin: number;

  @ApiProperty({ description: 'Maximum number of players' })
  @IsInt()
  @Min(2)
  maxPlayers: number;

  @ApiProperty({ description: 'Small blind amount' })
  @IsInt()
  @Min(1)
  smallBlind: number;

  @ApiPropertyOptional({ description: 'Clock interval in seconds (for BTC)' })
  @IsInt()
  @IsOptional()
  @Min(10)
  clockIntervalSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Scheduled start time (ISO string). If not provided, starts ASAP.',
  })
  @IsString()
  @IsOptional()
  scheduledStartTime?: string;

  @ApiPropertyOptional({
    description: 'Prize distribution percentages [1st, 2nd, 3rd]',
  })
  @IsOptional()
  prizeDistribution?: readonly [number, number, number];

  @ApiPropertyOptional({
    description: 'Guaranteed prize pool (GTD) regardless of player count',
  })
  @IsOptional()
  isGuarantee?: boolean;
}

/** Response DTO for a schedule entry */
export class ScheduleEntryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: TournamentType })
  type: TournamentType;

  @ApiProperty()
  buyin: number;

  @ApiProperty()
  maxPlayers: number;

  @ApiProperty()
  smallBlind: number;

  @ApiProperty()
  clockIntervalSeconds: number;

  @ApiProperty()
  scheduledStartTime: string | null;

  @ApiProperty()
  prizeDistribution: readonly [number, number, number];

  /** Total prize pool (buyin × maxPlayers) */
  @ApiProperty()
  totalPrize: number;

  /** Whether the prize pool is guaranteed regardless of entries */
  @ApiPropertyOptional()
  isGuarantee?: boolean;

  /** Current number of registered players */
  @ApiPropertyOptional()
  registeredCount?: number;

  @ApiProperty()
  status: TournamentScheduleStatus;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

/** Status of a schedule entry */
export enum TournamentScheduleStatus {
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Response DTO for schedule list */
export class ScheduleListResponseDto {
  @ApiProperty({ type: [ScheduleEntryResponseDto] })
  entries: ScheduleEntryResponseDto[];

  @ApiProperty()
  total: number;
}

/** Response DTO for upcoming tournaments */
export class UpcomingTournamentsResponseDto {
  @ApiProperty()
  next: ScheduleEntryResponseDto | null;

  @ApiProperty({ type: [ScheduleEntryResponseDto] })
  upcoming: ScheduleEntryResponseDto[];

  @ApiProperty()
  totalScheduled: number;
}

/** Query DTO for listing schedules */
export class ListSchedulesQueryDto {
  @ApiPropertyOptional({ enum: TournamentType })
  @IsEnum(TournamentType)
  @IsOptional()
  type?: TournamentType;

  @ApiPropertyOptional({ enum: TournamentScheduleStatus })
  @IsEnum(TournamentScheduleStatus)
  @IsOptional()
  status?: TournamentScheduleStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number = 20;
}
