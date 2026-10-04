.PHONY: help setup backend frontend run stop test lint clean ollama-check

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Install Python + Node dependencies
	@echo "=== Installing Python deps ==="
	cd backend && pip install -r requirements.txt
	@echo "=== Installing Node deps ==="
	cd frontend && npm install
	@echo "=== Done. Copy .env.example to .env and fill in Gmail creds. ==="

ollama-check: ## Verify Ollama is running and Gemma 3 1B is pulled
	@command -v ollama >/dev/null 2>&1 || { echo "Ollama not installed. Install: https://ollama.ai"; exit 1; }
	@curl -s http://localhost:11434/api/tags | grep -q "gemma3:1b" || { echo "Pulling gemma3:1b..."; ollama pull gemma3:1b; }
	@echo "Ollama + Gemma 3 1B ready."

backend: ## Run FastAPI backend (port 8000)
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Run Vite dev server (port 5173)
	cd frontend && npm run dev

run: ollama-check ## Start backend + frontend in parallel
	@echo "=== Starting Offmail ==="
	@trap 'kill 0' INT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

stop: ## Kill running backend + frontend
	@pkill -f "uvicorn main:app" || true
	@pkill -f "vite" || true
	@echo "Stopped."

test: ## Run backend tests
	cd backend && pytest -v

lint: ## Lint Python + TS
	cd backend && ruff check .
	cd frontend && npm run lint

clean: ## Remove caches + build artifacts
	rm -rf backend/__pycache__ backend/.pytest_cache backend/.ruff_cache
	rm -rf frontend/node_modules frontend/dist
	rm -f backend/offmail.db
	@echo "Cleaned."
