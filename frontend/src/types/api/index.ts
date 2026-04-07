// Interfaces base para las respuestas HTTP

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  statusCode: number;
}
