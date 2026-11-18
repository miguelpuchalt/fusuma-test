// Textos ficticios sin validez operativa. La tarjeta los muestra con «[FICTICIO]».
export type Protocol = {
  id: string
  title: string
  textByBuilding: Record<string, string>
}

export const PROTOCOLS: Protocol[] = [
  {
    id: 'evac-plan',
    title: 'Evacuación por las rutas del plano',
    textByBuilding: {
      'torre-central': 'Ruta verde, escaleras E-1 y E-2 hasta la salida principal',
      'anexo-a': 'Ruta azul, escalera única hasta el patio interior',
      laboratorios: 'Ruta naranja, escalera de servicio hasta el muelle de carga',
    },
  },
  {
    id: 'evac-nearest',
    title: 'Evacuación por las salidas más cercanas',
    textByBuilding: {
      'torre-central': 'Salidas Norte y Sur de planta baja',
      'anexo-a': 'Salida de recepción y salida lateral Oeste',
      laboratorios: 'Salida principal y salida de emergencia del sótano −1',
    },
  },
  {
    id: 'meet-inside',
    title: 'Punto de reunión en una planta',
    textByBuilding: {
      'torre-central': 'Vestíbulo de planta baja',
      'anexo-a': 'Sala polivalente de planta 1',
      laboratorios: 'Aula 0.2 de planta baja',
    },
  },
  {
    id: 'meet-outside',
    title: 'Punto de reunión exterior',
    textByBuilding: {
      'torre-central': 'Plaza exterior, punto PR-1',
      'anexo-a': 'Aparcamiento Este, punto PR-2',
      laboratorios: 'Jardín Norte, punto PR-3',
    },
  },
  {
    id: 'notify',
    title: 'Solo informar a los usuarios',
    textByBuilding: {
      'torre-central': 'Notificación a ocupantes de Torre Central',
      'anexo-a': 'Notificación a ocupantes del Anexo A',
      laboratorios: 'Notificación a ocupantes de Laboratorios',
    },
  },
]

export const PROTOCOL_IDS: string[] = PROTOCOLS.map((p) => p.id)

export function getProtocol(id: string): Protocol | undefined {
  return PROTOCOLS.find((p) => p.id === id)
}
