from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.base import Base
from app.db.session import engine
from app.routers import projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="API Monitoring Dashboard Backend", lifespan=lifespan)

app.include_router(projects.router)


@app.get("/health")
def health():
    return {"status": "ok"}
