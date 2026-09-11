# @aula/contracts

Fuente de verdad del contrato HTTP (sección 8): OpenAPI generado desde FastAPI +
tipos TypeScript generados para el frontend.

## Uso

```bash
# Con el venv de apps/api ya creado (make bootstrap)
npm run generate
```

Esto escribe `openapi.json` (no versionado; se regenera) y
`generated/client.d.ts` con los tipos TypeScript.

CI corre un diff de OpenAPI (sección 18) para detectar cambios incompatibles en el
contrato entre PRs; ver `.github/workflows/ci.yml`.

`generated/` y `openapi.json` se regeneran en cada build y no se commitean (ver
`.gitignore`).
