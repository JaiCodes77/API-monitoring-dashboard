from sqlalchemy.orm import declarative_base

Base = declarative_base()

from app.models.user import User 
from app.models.project import Project  
from app.models.service import Service 
from app.models.log import Log  
