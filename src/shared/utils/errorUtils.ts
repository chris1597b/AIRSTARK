export function getFriendlyErrorMessage(error: any): string {
  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
  }
  if (error.message?.includes('tardó demasiado')) {
    return 'La solicitud tardó demasiado. Inténtalo de nuevo.';
  }
  return error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
