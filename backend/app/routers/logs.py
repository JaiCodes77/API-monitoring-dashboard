from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.log import Log
from app.models.project import Project
from app.models.service import Service
from app.models.user import User
from app.schemas.log import LogCreate, LogOut

router = APIRouter(prefix="/projects/{project_id}/services/{service_id}/logs", tags=["logs"])


def _get_service_for_user_or_404(
    db: Session,
    project_id: int,
    service_id: int,
    user_id: int,
) -> Service:
    service = (
        db.query(Service)
        .join(Project, Project.id == Service.project_id)
        .filter(
            Service.id == service_id,
            Service.project_id == project_id,
            Project.owner_id == user_id,
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found in this project")
    return service


@router.post("/", response_model=LogOut, status_code=status.HTTP_201_CREATED)
def create_log(
    project_id: int,
    service_id: int,
    payload: LogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_service_for_user_or_404(db, project_id, service_id, current_user.id)

    log = Log(
        service_id=service_id,
        status_code=payload.status_code,
        response_time_ms=payload.response_time_ms,
        is_success=payload.is_success,
        message=payload.message,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/", response_model=list[LogOut])
def list_logs(
    project_id: int,
    service_id: int,
    is_success: bool | None = None,
    status_code: int | None = None,
    from_time: datetime | None = None,
    to_time: datetime | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_service_for_user_or_404(db, project_id, service_id, current_user.id)

    query = db.query(Log).filter(Log.service_id == service_id)

    if is_success is not None:
        query = query.filter(Log.is_success == is_success)
    if status_code is not None:
        query = query.filter(Log.status_code == status_code)
    if from_time is not None:
        query = query.filter(Log.created_at >= from_time)
    if to_time is not None:
        query = query.filter(Log.created_at <= to_time)

    return query.order_by(Log.created_at.desc()).offset(skip).limit(limit).all()
