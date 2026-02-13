from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict 

class ServiceCreate(BaseModel): 
    service_id : int 
    status_code : int 
    response_time_ms : int 
    is_success : bool 
    message : Optional[str] = None


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id : int 
    service_id : int 
    status_code : int 
    response_time_ms : int
    is_success : bool 
    message : Optional[str] = None
    created_at : datetime