from fastapi import FastAPI

from app.db.base import Base
from app.db.session import engine

app = FastAPI(title="API Monitoring Dashboard Backend") 

@app.on_event("startup")
def on_startup()->None:
    Base.metadata.create_all(bind=engine)

@app.get('/health')
def health():
    return {"status" : "ok"}