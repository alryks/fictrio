import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

type ErrorResponseBody = {
  message?: unknown;
  error?: unknown;
  issues?: unknown;
};

type HttpReply = {
  status: (statusCode: number) => {
    send: (body: unknown) => void;
  };
};

type HttpRequest = {
  url?: string;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpReply>();
    const request = context.getRequest<HttpRequest>();
    const statusCode = this.getStatusCode(exception);
    const body = this.getBody(exception);

    response.status(statusCode).send({
      statusCode,
      error: this.getError(body, exception, statusCode),
      message: this.getMessage(body, exception),
      details: body?.issues,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getBody(exception: unknown): ErrorResponseBody | null {
    if (!(exception instanceof HttpException)) {
      return null;
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { message: response };
    }

    if (this.isErrorResponseBody(response)) {
      return response;
    }

    return null;
  }

  private getError(
    body: ErrorResponseBody | null,
    exception: unknown,
    statusCode: number,
  ): string {
    if (typeof body?.error === 'string') {
      return body.error;
    }

    if (exception instanceof Error && statusCode === 500) {
      return 'Internal Server Error';
    }

    return 'Request Error';
  }

  private getMessage(
    body: ErrorResponseBody | null,
    exception: unknown,
  ): unknown {
    if (body?.message) {
      return body.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Непредвиденная ошибка';
  }

  private isErrorResponseBody(value: unknown): value is ErrorResponseBody {
    return typeof value === 'object' && value !== null;
  }
}
