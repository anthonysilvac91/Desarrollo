import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
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
      if (typeof responseBody === 'object' && responseBody !== null && 'message' in responseBody) {
        errorResponse.message = (responseBody as any).message;
      } else if (typeof responseBody === 'string') {
        errorResponse.message = responseBody;
      }
    }

    // Usar Warning para 4xx y Error para 5xx (incluyendo la traza del error en caso de 500)
    if (status >= 500) {
      this.logger.error(`[${request.method}] ${request.url} - ${status} - Error: ${exception instanceof Error ? exception.stack : JSON.stringify(exception)}`);
    } else {
      // Opcional: Descomentar si se desea rastrear todos los 4xx (pueden ser algo ruidosos)
      // this.logger.warn(`[${request.method}] ${request.url} - ${status} - ${errorResponse.message}`);
    }

    response.status(status).json(errorResponse);
  }
}
