export type Building = {
  id: string
  name: string
  floors: number[]
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

export const BUILDINGS: Building[] = [
  { id: 'torre-central', name: 'Torre Central', floors: range(-2, 8) },
  { id: 'anexo-a', name: 'Edificio Anexo A', floors: range(-1, 3) },
  { id: 'laboratorios', name: 'Laboratorios', floors: range(-1, 2) },
]

export function getBuilding(id: string): Building | undefined {
  return BUILDINGS.find((b) => b.id === id)
}

// n > 0 → «Planta n»; 0 → «Planta baja»; n < 0 → «Sótano |n|».
export function floorLabel(n: number): string {
  if (n > 0) return `Planta ${n}`
  if (n === 0) return 'Planta baja'
  return `Sótano ${Math.abs(n)}`
}
