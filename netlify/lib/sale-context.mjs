// Optional, non-monetary snapshot. The source is resolved on the server.
export function saleContext(input, check) {
 if (input == null) return undefined;
 check(typeof input === 'object' && !Array.isArray(input), 'Contexto de factura inválido.');
 const result = {};
 for (const [key, max] of Object.entries({resource:200,resourceLabel:40,responsible:200,modality:20,ticket:80,sourceId:80,sourceModule:40,sourceName:200,project:200})) {
  if (input[key] == null || input[key] === '') continue;
  check(typeof input[key] === 'string' && input[key].length <= max && !/[\u0000-\u001f]/.test(input[key]), 'Contexto de factura inválido.');
  if (input[key].trim()) result[key] = input[key].trim();
 }
 check(!result.modality || ['local','llevar','domicilio'].includes(result.modality), 'Modalidad inválida.');
 return Object.keys(result).length ? result : undefined;
}
