.PHONY: bootstrap dev migrate seed test lint build infra-synth down logs

API_DIR := apps/api
WEB_DIR := apps/web
VENV := $(API_DIR)/.venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

bootstrap: ## Instala dependencias de backend y frontend, y levanta la DB local.
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -e "$(API_DIR)[dev]"
	cd $(WEB_DIR) && npm install
	docker compose up -d db
	@echo "Bootstrap listo. Corre 'make migrate && make seed' y luego 'make dev'."

dev: ## Levanta DB + API en Docker y el frontend con Vite.
	docker compose up -d db api
	cd $(WEB_DIR) && npm run dev

migrate: ## Aplica migraciones Alembic contra la DB local.
	cd $(API_DIR) && DATABASE_URL=postgresql+psycopg://aula:aula@localhost:5432/aula \
		.venv/bin/alembic upgrade head

seed: ## Siembra datos ficticios idempotentes (colegio demo, roles, usuarios, curso, tarea).
	DATABASE_URL=postgresql+psycopg://aula:aula@localhost:5432/aula $(PY) scripts/seed.py

test: ## Corre pruebas de backend (requiere DB local corriendo) e infra.
	cd $(API_DIR) && DATABASE_URL=postgresql+psycopg://aula:aula@localhost:5432/aula_test \
		.venv/bin/pytest
	cd infra && npm test

lint: ## Lint y tipos de backend y frontend.
	cd $(API_DIR) && .venv/bin/ruff check . && .venv/bin/mypy app
	cd $(WEB_DIR) && npm run lint && npm run typecheck

build: ## Build de producción del frontend y verificación de import del backend.
	cd $(WEB_DIR) && npm run build
	cd $(API_DIR) && .venv/bin/python -c "import app.main"

infra-synth: ## cdk synth de los stacks; no requiere credenciales AWS reales para stacks env-agnostic.
	cd infra && npm install && npx cdk synth

down: ## Detiene los contenedores locales.
	docker compose down

logs: ## Logs de los contenedores locales.
	docker compose logs -f
