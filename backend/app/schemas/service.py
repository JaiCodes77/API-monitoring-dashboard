from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ServiceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    url: HttpUrl
    method: str = Field(default="GET", min_length=3, max_length=10)


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    url: Optional[HttpUrl] = None
    method: Optional[str] = Field(default=None, min_length=3, max_length=10)
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
