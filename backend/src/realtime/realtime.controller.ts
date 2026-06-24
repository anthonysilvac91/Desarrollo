import {
  Controller,
  MessageEvent,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import { RealtimeService } from './realtime.service';

@ApiTags('Realtime')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('events')
  @ApiOperation({
    summary:
      'Stream de eventos por organizacion para refresco automatico del frontend',
  })
  events(@Request() req: any): Observable<MessageEvent> {
    return this.realtimeService.subscribe(req.user);
  }
}
