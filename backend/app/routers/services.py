from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.service import Service
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceOut, ServiceUpdate


class ServiceStatusFilter(str, Enum):
    active = "active"
    inactive = "inactive"


router = APIRouter(prefix="/projects/{project_id}/services", tags=["services"])


def _get_project_for_user_or_404(db: Session, project_id: int, user_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == user_id)
        .first()
    )
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
        raise HTTPException(status_code=404, detail="Service not found in this project")
    return service


@router.post("/", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(
    project_id: int,
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_for_user_or_404(db, project_id, current_user.id)

    service = Service(
        project_id=project_id,
        name=payload.name,
        url=str(payload.url),
        method=payload.method.upper(),
    )

    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("/", response_model=list[ServiceOut])
def list_services(
    project_id: int,
    status_filter: ServiceStatusFilter | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_for_user_or_404(db, project_id, current_user.id)

    query = db.query(Service).filter(Service.project_id == project_id)
    if status_filter == ServiceStatusFilter.active:
        query = query.filter(Service.is_active.is_(True))
    elif status_filter == ServiceStatusFilter.inactive:
        query = query.filter(Service.is_active.is_(False))

    return query.order_by(Service.id.desc()).offset(skip).limit(limit).all()


@router.get("/{service_id}", response_model=ServiceOut)
def get_service(
    project_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_for_user_or_404(db, project_id, current_user.id)
    return _get_service_or_404(db, project_id, service_id)


@router.patch("/{service_id}", response_model=ServiceOut)
def update_service(
    project_id: int,
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_for_user_or_404(db, project_id, current_user.id)
    service = _get_service_or_404(db, project_id, service_id)

    update_data = payload.model_dump(exclude_unset=True)
    if "url" in update_data:
        update_data["url"] = str(update_data["url"])
    if "method" in update_data and update_data["method"] is not None:
        update_data["method"] = update_data["method"].upper()

    for key, value in update_data.items():
        setattr(service, key, value)

    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    project_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_for_user_or_404(db, project_id, current_user.id)
    service = _get_service_or_404(db, project_id, service_id)

    db.delete(service)
    db.commit()
    return None
