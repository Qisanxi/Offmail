.PHONY: help setup backend frontend run stop test lint clean ollama-check

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Install Python + Node dependencies
	@echo "=== Installing Python deps ==="
	pip install -r backend/requirements.txt
	@echo "=== Installing Node deps ==="
	cd frontend && npm install
	@echo "=== Done. Copy .env.example to .env and fill in Gmail creds. ==="

ollama-check: ## Verify Ollama is running and Gemma 3 1B is pulled
	@command -v ollama >/dev/null 2>&1 || { echo "Ollama not installed. Install: https://ollama.ai"; exit 1; }
	@curl -s http://localhost:11434/api/tags | grep -q "gemma3:1b" || { echo "Pulling gemma3:1b..."; ollama pull gemma3:1b; }
	@echo "Ollama + Gemma 3 1B ready."

backend: ## Run FastAPI backend (port 8000, localhost only)
	@echo "=== Starting backend (127.0.0.1:8000) ==="
	@echo "=== Per-install auth token: $$(cat .offmail_token 2>/dev/null || echo 'will be generated on first run') ==="
	uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

frontend: ## Run Vite dev server (port 5173)
	@echo "=== Starting frontend (http://localhost:5173) ==="
	cd frontend && npm run dev

run: ollama-check ## Start backend + frontend in parallel
	@trap 'kill 0' INT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

stop: ## Kill running backend + frontend
	@pkill -f "uvicorn backend.main:app" || true
	@pkill -f "vite" || true
	@echo "Stopped."

test: ## Run backend tests
	python -m pytest backend/tests/ -v

lint: ## Lint Python (ruff)
	ruff check backend/

clean: ## Remove caches + build artifacts
	rm -rf backend/__pycache__ backend/.pytest_cache backend/.ruff_cache
	rm -rf frontend/node_modules frontend/dist
	rm -f offmail.db offmail.db-journal .offmail_token
	@echo "Cleaned."
