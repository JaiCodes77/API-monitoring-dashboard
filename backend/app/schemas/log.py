from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LogCreate(BaseModel):
    status_code: int = Field(ge=100, le=599)
    response_time_ms: int = Field(ge=0, le=120000)
    is_success: bool
    message: Optional[str] = Field(default=None, max_length=500)


class LogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    service_id: int
    status_code: int
    response_time_ms: int
    is_success: bool
    message: Optional[str] = None
    created_at: datetime
