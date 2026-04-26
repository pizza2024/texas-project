import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MissionService } from './mission.service';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

@Controller('missions')
@UseGuards(AuthGuard('jwt'))
export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  /** Returns all missions with the user's current progress for the active period(s). */
  @Get()
  async getMissions(@Request() req: { user: JwtUser }) {
    return this.missionService.getUserMissions(req.user.userId);
  }

  /** Returns active (incomplete or completed-not-claimed) missions for the current period. */
  @Get('active')
  async getActiveMissions(@Request() req: { user: JwtUser }) {
    return this.missionService.getActiveMissions(req.user.userId);
  }

  /** Manually trigger daily mission reset (admin use only — for testing). */
  @Post('admin/reset-daily')
  async resetDaily(@Request() req: { user: JwtUser }) {
    // In production this should be guarded by AdminGuard
    const count = await this.missionService.resetDailyMissions();
    return { message: `Expired ${count} daily mission records` };
  }

  /** Manually trigger weekly mission reset (admin use only — for testing). */
  @Post('admin/reset-weekly')
  async resetWeekly(@Request() req: { user: JwtUser }) {
    const count = await this.missionService.resetWeeklyMissions();
    return { message: `Expired ${count} weekly mission records` };
  }
}
