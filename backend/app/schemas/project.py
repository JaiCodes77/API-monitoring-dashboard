from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    owner_id: int
    created_at: datetime
