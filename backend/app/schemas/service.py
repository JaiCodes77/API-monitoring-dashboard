from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, HttpUrl


class ServiceCreate(BaseModel):
    name: str
    url: HttpUrl
    method: str = "GET"


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[HttpUrl] = None
    method: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    url: str
    method: str
    is_active: bool
    created_at: datetime
