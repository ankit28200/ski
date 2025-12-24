from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class LifestyleAnswers(BaseModel):
    sleep_hours: float | None = None
    stress_level: int | None = Field(default=None, ge=0, le=10)
    sunscreen_days_per_week: int | None = Field(default=None, ge=0, le=7)
    smoking: bool | None = None


class AnalysisAnswers(BaseModel):
    age: int | None = Field(default=None, ge=1, le=120)
    sex: str | None = None
    concerns: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    lifestyle: LifestyleAnswers | None = None


class MetricResult(BaseModel):
    id: str
    label: str
    severity: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    summary: str
    tips: list[str] = Field(default_factory=list)
    value: float | None = None
    unit: str | None = None


class RoutineStep(BaseModel):
    time: str
    step: str
    why: str


class ImageQuality(BaseModel):
    score: float = Field(ge=0, le=1)
    brightness: float = Field(ge=0, le=1)
    blur: float = Field(ge=0, le=1)
    face_found: bool
    face_coverage: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    analysis_id: str
    selected_image: int
    overall_score: float = Field(ge=0, le=100)
    skin_type: str
    estimated_fitzpatrick: int | None = Field(default=None, ge=1, le=6)
    skin_age: float | None = None
    skin_age_delta: float | None = None
    metrics: list[MetricResult]
    quality: ImageQuality
    routine: list[RoutineStep] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    heatmaps: dict[str, str] | None = None
    debug: dict[str, Any] | None = None


class ChatTurn(BaseModel):
    role: Literal["user", "model"]
    text: str


class DoctorChatResponse(BaseModel):
    reply: str
