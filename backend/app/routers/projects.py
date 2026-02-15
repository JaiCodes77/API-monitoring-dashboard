from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"]) 


@router.post('/', response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
payload : ProjectCreate,
owner_id : int = Query(...),
db : Session = Depends(get_db)
):
    owner = db.get(User, owner_id) 
    if not owner: 
        raise HTTPException(status_code=404, detail="owner user not found!")
    
    project = Project(name = payload.name, owner_id = owner_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
