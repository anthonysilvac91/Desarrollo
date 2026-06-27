import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      const responseBody = exception.getResponse();
      // Mapear los mensajes de error retornados por ValidationPipe u otros
      if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
      ) {
        errorResponse.message = (responseBody as any).message;
      } else if (typeof responseBody === 'string') {
        errorResponse.message = responseBody;
      }
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status} - ${exception instanceof Error ? exception.stack : JSON.stringify(exception)}`,
      );
    } else if (status === 401 || status === 403) {
      // Auth failures are auditable signals worth tracking in production logs
      this.logger.warn(
        `[${request.method}] ${request.url} - ${status} - ${errorResponse.message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
