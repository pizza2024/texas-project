import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AdminGuard } from '../admin/guards/admin.guard';
import { InsuranceService } from './insurance.service';

@Controller('admin/insurance')
@UseGuards(AdminGuard)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  /**
   * Get paginated list of insurance transactions.
   *
   * GET /admin/insurance?page=1&limit=20&handId=xxx&userId=xxx
   */
  @Get()
  async getTransactions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('handId') handId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.insuranceService.getInsuranceTransactions({
      page,
      limit,
      handId,
      userId,
    });
  }

  /**
   * Get insurance statistics for admin dashboard.
   *
   * GET /admin/insurance/stats
   */
  @Get('stats')
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.insuranceService.getInsuranceStats({
      startDate: start,
      endDate: end,
    });
  }
}
