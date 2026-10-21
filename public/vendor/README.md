# Bibliotecas de exportación

Estas copias se obtuvieron de las dependencias npm del proyecto y se cargan únicamente para las descargas de PDF y ZIP. No requieren un paso de compilación ni un CDN externo.

- `fflate.js`: fflate 0.8.3, distribución `umd/index.js`, licencia MIT.
- `jspdf.js`: jsPDF 4.2.1, distribución `dist/jspdf.umd.min.js`, licencia MIT.
- `autotable.js`: jsPDF-AutoTable 5.0.8, distribución `dist/jspdf.plugin.autotable.min.js`, licencia MIT.

Cuando se actualicen estas dependencias, actualizar también sus copias locales. Se conservaron los avisos de las distribuciones originales.

- `zxing-browser.js`: @zxing/browser 0.1.5, distribución UMD, licencia MIT (ZXING-LICENSE.txt). Respaldo local para cámaras sin BarcodeDetector; se carga únicamente al abrir el escáner.

- `xlsx.js`: @e965/xlsx 0.20.3, distribución local `dist/xlsx.full.min.js`, licencia Apache-2.0 (XLSX-LICENSE.txt). Se carga bajo demanda para importar CSV/Excel y exportar tablas XLSX. No se ejecutan macros ni fórmulas de los archivos.
