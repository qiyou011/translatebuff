export interface BrandViolation {
  file: string
  line: number
  token: string
  text: string
}

export function findResidualBrand(entries: { path: string; content: string }[]): BrandViolation[]
