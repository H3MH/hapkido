Genera enlaces ofuscados para los invitados

Uso:

Desde la raíz del proyecto ejecuta:

```powershell
.\scripts\generate_links_obfuscated.ps1
```

- El script lee `assets/data/invitados.json` y usa la misma ofuscación que `assets/js/app.js` (XOR con clave 7 + base64url sin padding).
- Por defecto usa el dominio público de Azure y añade `pv=20260625` para que WhatsApp recalcule el preview si había cacheado enlaces antiguos.
- Si necesitas otro dominio, pasa `-BaseUrl "https://tu-dominio/index.html?pv=20260625"`.
- El archivo de salida es `invitados_links.csv`.

Para regenerar la imagen que usa WhatsApp en la tarjeta:

```powershell
.\scripts\generate_social_preview.ps1
```
