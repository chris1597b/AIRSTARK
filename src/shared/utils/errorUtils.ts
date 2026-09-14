export function getFriendlyErrorMessage(error: any): string {
  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
  }
  if (error.message?.includes('tardó demasiado')) {
    return 'La solicitud tardó demasiado. Inténtalo de nuevo.';
  }
  if (
    error.status === 503 ||
    error.message?.includes('UNAVAILABLE') ||
    error.message?.includes('high demand') ||
    error.message?.includes('503')
  ) {
    return 'El servicio de IA está muy solicitado en este momento. Inténtalo de nuevo en unos segundos.';
  }
  if (error.status >= 500 || error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
    return 'Ocurrió un problema en el servidor. Inténtalo de nuevo.';
  }
  return error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
