Genera enlaces ofuscados para los invitados

Requisitos:
- Node.js instalado

Uso:

Desde la raíz del proyecto ejecuta:

```bash
node scripts/generate_links_obfuscated.js > invitados_links.csv
```

- El script lee `assets/data/invitados.json` y usa la misma ofuscación que `assets/js/app.js` (XOR con clave 7 + base64url sin padding).
- Reemplaza `BASE` en el script por la URL real de tu invitación si lo deseas.
