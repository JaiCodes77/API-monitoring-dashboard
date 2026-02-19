from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.routers import auth, logs, projects, services


def _run_legacy_sqlite_migrations() -> None:
    # Repair legacy local DBs where projects.name was accidentally created as projects."255".
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    with engine.begin() as connection:
        columns = connection.execute(text("PRAGMA table_info(projects)")).fetchall()
        column_names = {row[1] for row in columns}
        if "255" in column_names and "name" not in column_names:
            connection.execute(text('ALTER TABLE projects RENAME COLUMN "255" TO name'))


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_legacy_sqlite_migrations()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="API Monitoring Dashboard Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(services.router)
app.include_router(logs.router)


@app.get("/health")
def health():
    return {"status": "ok"}
