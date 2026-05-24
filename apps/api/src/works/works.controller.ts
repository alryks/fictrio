import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { GetWorksQueryDto } from './works.dto';
import { WorksService } from './works.service';

@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get()
  findMany(@Query() query: GetWorksQueryDto) {
    return this.worksService.findMany(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.worksService.findOne(id);
  }
}
