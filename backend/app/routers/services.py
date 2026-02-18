from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.project import Project
from app.models.service import Service
from app.schemas.service import ServiceCreate, ServiceOut, ServiceUpdate


class ServiceStatusFilter(str, Enum):
    active = "active"
    inactive = "inactive"


router = APIRouter(prefix="/projects/{project_id}/services", tags=["services"])


def _get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_service_or_404(db: Session, project_id: int, service_id: int) -> Service:
    service = (
        db.query(Service)
        .filter(Service.id == service_id, Service.project_id == project_id)
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found in this project!")
    return service



@router.post("/", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(
    project_id : int,
    payload : ServiceCreate,
    db : Session = Depends(get_db)
):
    _get_project_or_404(db, project_id)
    
    service = Service(
        project_id = project_id,
        name = payload.name,
        url = str(payload.url),
        method = payload.method.upper()
    ) 

    db.add(service)
    db.commit()
    db.refresh(service)
    return service