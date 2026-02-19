from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.service import Service


class Log(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False, index=True)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    response_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    is_success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # Keep nullable in DB, but avoid Optional[] typing because SQLAlchemy 2.0.38 + Python 3.14 can crash on union parsing.
    message: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    service: Mapped[Service] = relationship("Service", back_populates="logs")
