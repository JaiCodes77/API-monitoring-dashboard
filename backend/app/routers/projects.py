from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _get_project_for_user_or_404(db: Session, project_id: int, user_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == user_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(name=payload.name, owner_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectOut])
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_project_for_user_or_404(db, project_id, current_user.id)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_for_user_or_404(db, project_id, current_user.id)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_for_user_or_404(db, project_id, current_user.id)

    db.delete(project)
    db.commit()
    return None
