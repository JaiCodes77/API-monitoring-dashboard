from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post('/', response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    owner_id: int = Query(...),
    db: Session = Depends(get_db)
):
    owner = db.get(User, owner_id)
    if not owner:
        raise HTTPException(status_code=404, detail="owner user not found!")

    project = Project(name=payload.name, owner_id=owner_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=list[ProjectOut])
def list_projects(skip: int = 0,
                  limit: int = 20,
                  db: Session = Depends(get_db)):

    return db.query(Project).offset(skip).limit(limit).all()


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="project not found!")
    return project 


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int, 
    payload: ProjectUpdate, 
    db: Session = Depends(get_db)
): 
    project = db.get(Project,project_id)
    if not project: 
        raise HTTPException(status_code=404, detail="project not found!")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key,value in update_data.items():
        setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id : int,
    db:Session = Depends(get_db)
): 
    project = db.get(Project, project_id)
    if not project: 
        raise HTTPException(status_code=404, detail="project not found!")
    
    db.delete(project)
    db.commit()
    return None