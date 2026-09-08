export function safeError(error: any): string {
  if (error && typeof error.message === 'string') {
    if (error.message.startsWith('ROOM_FULL') || error.message.startsWith('ROOM_UNAVAILABLE')) {
      return error.message;
    }
    if (error.code === 'P2002') {
      return 'Duplicate entry';
    }
    if (error.code === 'P2025') {
      return 'Record not found';
    }
  }
  return 'Internal server error';
}
