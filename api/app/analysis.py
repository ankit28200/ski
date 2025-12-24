from __future__ import annotations

import base64
import io
import uuid
from dataclasses import dataclass
from functools import lru_cache

import cv2
import mediapipe as mp
import numpy as np
from fastapi import UploadFile
from PIL import Image, ImageOps

from .schemas import AnalysisAnswers, AnalysisResponse, ImageQuality, MetricResult, RoutineStep


@dataclass(frozen=True)
class _PerImage:
    metrics: list[MetricResult]
    quality: ImageQuality
    skin_type: str
    fitzpatrick: int | None
    skin_age: float | None
    skin_age_delta: float | None
    heatmaps: dict[str, str] | None
    debug: dict[str, object] | None


@lru_cache(maxsize=1)
def _face_mesh() -> mp.solutions.face_mesh.FaceMesh:
    return mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    )


def _clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def _encode_png_data_uri(bgra: np.ndarray) -> str | None:
    ok, buf = cv2.imencode(".png", bgra)
    if not ok:
        return None
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _norm01_pos_map(x: np.ndarray, mask: np.ndarray, hi_p: float = 95.0) -> np.ndarray:
    vals = x[mask > 0].astype(np.float32)
    if vals.size < 50:
        return np.zeros_like(x, dtype=np.float32)
    hi = float(np.percentile(vals, hi_p))
    if hi <= 1e-6:
        return np.zeros_like(x, dtype=np.float32)
    out = np.clip(x.astype(np.float32) / hi, 0.0, 1.0)
    out *= (mask > 0).astype(np.float32)
    return out


def _heatmap_data_uri(
    intensity: np.ndarray,
    mask: np.ndarray,
    color_bgr: tuple[int, int, int],
    *,
    max_dim: int = 320,
    max_alpha: float = 0.85,
) -> str | None:
    h, w = intensity.shape[:2]
    scale = 1.0
    if max(h, w) > max_dim:
        scale = float(max_dim) / float(max(h, w))

    nw = int(max(1, round(w * scale)))
    nh = int(max(1, round(h * scale)))

    inten = intensity.astype(np.float32)
    if scale != 1.0:
        inten = cv2.resize(inten, (nw, nh), interpolation=cv2.INTER_AREA)
        m = cv2.resize(mask, (nw, nh), interpolation=cv2.INTER_NEAREST)
    else:
        m = mask

    inten = np.nan_to_num(inten, nan=0.0, posinf=0.0, neginf=0.0)
    inten = np.clip(inten, 0.0, 1.0)
    if float(np.max(inten)) <= 1e-6:
        return None

    alpha = (inten * float(max_alpha) * 255.0).astype(np.uint8)
    if max(nw, nh) >= 96:
        sigma = max(1.0, float(max(nw, nh)) / 160.0)
        alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=sigma, sigmaY=sigma)
    alpha = (alpha.astype(np.float32) * (m > 0).astype(np.float32)).astype(np.uint8)
    if int(np.max(alpha)) == 0:
        return None

    b = np.full_like(alpha, int(color_bgr[0]), dtype=np.uint8)
    g = np.full_like(alpha, int(color_bgr[1]), dtype=np.uint8)
    r = np.full_like(alpha, int(color_bgr[2]), dtype=np.uint8)
    bgra = cv2.merge([b, g, r, alpha])
    return _encode_png_data_uri(bgra)


def _decode_upload_to_bgr(data: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(data))
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")
    rgb = np.array(image)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    h, w = bgr.shape[:2]
    max_dim = 1024
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    return bgr


def _laplacian_blur(gray: np.ndarray) -> float:
    v = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    v = max(0.0, min(v, 800.0))
    return v / 800.0


def _brightness(gray: np.ndarray) -> float:
    return _clip01(float(np.mean(gray)) / 255.0)


def _indices_from_connections(connections) -> list[int]:
    idx: set[int] = set()
    for a, b in connections:
        idx.add(int(a))
        idx.add(int(b))
    return list(idx)


def _hull_mask(points_xy: np.ndarray, shape_hw: tuple[int, int]) -> np.ndarray:
    mask = np.zeros(shape_hw, dtype=np.uint8)
    if points_xy.size == 0:
        return mask
    hull = cv2.convexHull(points_xy.astype(np.int32))
    if hull is None or len(hull) < 3:
        return mask
    cv2.fillConvexPoly(mask, hull, 255)
    return mask


def _get_landmarks(rgb: np.ndarray) -> np.ndarray | None:
    h, w = rgb.shape[:2]
    results = _face_mesh().process(rgb)
    if not results.multi_face_landmarks:
        return None
    face = results.multi_face_landmarks[0]
    pts = np.array([(lm.x * w, lm.y * h) for lm in face.landmark], dtype=np.float32)
    return pts


def _compute_quality(gray: np.ndarray, landmarks: np.ndarray | None) -> ImageQuality:
    blur = _laplacian_blur(gray)
    bright = _brightness(gray)

    warnings: list[str] = []

    if bright < 0.25:
        warnings.append("Lighting is low; move to brighter, even light.")
    if bright > 0.88:
        warnings.append("Lighting is very strong; avoid overexposure.")
    if blur < 0.25:
        warnings.append("Image is blurry; hold still and refocus.")

    face_found = landmarks is not None
    face_coverage = 0.0

    if landmarks is not None:
        h, w = gray.shape[:2]
        x1 = float(np.min(landmarks[:, 0]))
        y1 = float(np.min(landmarks[:, 1]))
        x2 = float(np.max(landmarks[:, 0]))
        y2 = float(np.max(landmarks[:, 1]))
        face_area = max(0.0, (x2 - x1) * (y2 - y1))
        face_coverage = float(min(1.0, face_area / float(h * w)))
        if face_coverage < 0.08:
            warnings.append("Move closer to the camera; face is too small in frame.")
    else:
        warnings.append("No face detected. Ensure your full face is visible.")

    score = 0.0
    if face_found:
        blur_w = 0.45
        bright_w = 0.35
        size_w = 0.20

        bright_centered = 1.0 - abs(bright - 0.55) / 0.55
        bright_centered = _clip01(bright_centered)
        size_score = min(1.0, face_coverage / 0.20)

        score = blur_w * blur + bright_w * bright_centered + size_w * size_score

    score = _clip01(score)

    return ImageQuality(
        score=score,
        brightness=bright,
        blur=blur,
        face_found=face_found,
        face_coverage=face_coverage,
        warnings=warnings,
    )


def _skin_masks(bgr: np.ndarray, landmarks: np.ndarray) -> dict[str, np.ndarray]:
    h, w = bgr.shape[:2]
    mp_face_mesh = mp.solutions.face_mesh

    face_idx = _indices_from_connections(mp_face_mesh.FACEMESH_FACE_OVAL)
    left_eye_idx = _indices_from_connections(mp_face_mesh.FACEMESH_LEFT_EYE)
    right_eye_idx = _indices_from_connections(mp_face_mesh.FACEMESH_RIGHT_EYE)
    lips_idx = _indices_from_connections(mp_face_mesh.FACEMESH_LIPS)

    face_points = landmarks[face_idx]
    left_eye_points = landmarks[left_eye_idx]
    right_eye_points = landmarks[right_eye_idx]
    lips_points = landmarks[lips_idx]

    face_mask = _hull_mask(face_points, (h, w))
    left_eye_mask = _hull_mask(left_eye_points, (h, w))
    right_eye_mask = _hull_mask(right_eye_points, (h, w))
    lips_mask = _hull_mask(lips_points, (h, w))

    exclude = cv2.bitwise_or(left_eye_mask, right_eye_mask)
    exclude = cv2.bitwise_or(exclude, lips_mask)

    kernel = np.ones((7, 7), np.uint8)
    face_mask = cv2.erode(face_mask, kernel, iterations=1)
    exclude = cv2.dilate(exclude, kernel, iterations=2)

    skin_mask = cv2.bitwise_and(face_mask, cv2.bitwise_not(exclude))

    return {
        "face": face_mask,
        "skin": skin_mask,
        "left_eye": left_eye_mask,
        "right_eye": right_eye_mask,
        "lips": lips_mask,
    }


def _severity_from_range(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.0
    t = (value - lo) / (hi - lo)
    t = float(max(0.0, min(t, 1.0)))
    return 100.0 * t


def _estimate_fitzpatrick(l_mean: float, b_mean: float) -> int:
    l = float(max(0.0, min(l_mean, 255.0)))
    b = float(max(0.0, min(b_mean, 255.0)))
    melanin_proxy = (255.0 - l) * 0.9 + max(0.0, b - 128.0) * 0.25
    if melanin_proxy < 55:
        return 1
    if melanin_proxy < 85:
        return 2
    if melanin_proxy < 115:
        return 3
    if melanin_proxy < 145:
        return 4
    if melanin_proxy < 175:
        return 5
    return 6


def _metric(id_: str, label: str, severity: float, confidence: float, summary: str, tips: list[str], value: float | None = None, unit: str | None = None) -> MetricResult:
    return MetricResult(
        id=id_,
        label=label,
        severity=float(max(0.0, min(severity, 100.0))),
        confidence=float(max(0.0, min(confidence, 1.0))),
        summary=summary,
        tips=tips,
        value=value,
        unit=unit,
    )


def _compute_metrics(
    bgr: np.ndarray, masks: dict[str, np.ndarray], quality: ImageQuality
) -> tuple[list[MetricResult], int | None, dict[str, str] | None, dict[str, object]]:
    skin_mask = masks["skin"]

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape[:2]

    skin_pixels_lab = lab[skin_mask > 0]
    if skin_pixels_lab.size == 0:
        return [], None, None, {}

    l_mean = float(np.mean(skin_pixels_lab[:, 0]))
    a_mean = float(np.mean(skin_pixels_lab[:, 1]))
    b_mean = float(np.mean(skin_pixels_lab[:, 2]))
    l_std = float(np.std(skin_pixels_lab[:, 0]))

    a_red = max(0.0, a_mean - 128.0)
    redness_sev = _severity_from_range(a_red, 6.0, 22.0)

    uneven_sev = _severity_from_range(l_std, 9.0, 22.0)

    v = hsv[:, :, 2]
    s = hsv[:, :, 1]
    highlights = (v > 235) & (s < 90) & (skin_mask > 0)
    skin_px = int(np.sum(skin_mask > 0))
    highlight_ratio = float(np.sum(highlights)) / float(max(1, skin_px))
    oiliness_sev = _severity_from_range(highlight_ratio, 0.004, 0.030)

    lap = cv2.Laplacian(gray, cv2.CV_32F)
    texture_value = float(np.mean(np.abs(lap)[skin_mask > 0]))
    texture_sev = _severity_from_range(texture_value, 2.5, 10.0)

    face_mask = masks["face"]

    top_band = np.zeros((h, w), dtype=np.uint8)
    y_cut = int(h * 0.35)
    top_band[:y_cut, :] = 255
    forehead_mask = cv2.bitwise_and(face_mask, top_band)
    forehead_mask = cv2.bitwise_and(forehead_mask, skin_mask)

    eye_union = cv2.bitwise_or(masks["left_eye"], masks["right_eye"])
    eye_ring = cv2.dilate(eye_union, np.ones((23, 23), np.uint8), iterations=1)
    eye_ring = cv2.bitwise_and(eye_ring, skin_mask)

    wrinkles_value = 0.0
    wrinkles_den = 0
    for region in [forehead_mask, eye_ring]:
        n = int(np.sum(region > 0))
        if n > 0:
            wrinkles_value += float(np.mean(np.abs(lap)[region > 0]))
            wrinkles_den += 1
    if wrinkles_den > 0:
        wrinkles_value /= float(wrinkles_den)

    wrinkles_sev = _severity_from_range(wrinkles_value, 2.4, 9.0)

    dark_circle_sev = 0.0
    under_eye_count = 0
    under_eye_debug: dict[str, float] = {}

    for side in ["left_eye", "right_eye"]:
        eye_mask = masks[side]
        ys, xs = np.where(eye_mask > 0)
        if ys.size == 0:
            continue
        x1, x2 = int(xs.min()), int(xs.max())
        y1, y2 = int(ys.min()), int(ys.max())
        ew = max(1, x2 - x1)
        eh = max(1, y2 - y1)

        under = np.zeros_like(eye_mask)
        uy1 = int(y1 + 0.70 * eh)
        uy2 = int(y1 + 1.85 * eh)
        ux1 = int(x1 - 0.15 * ew)
        ux2 = int(x2 + 0.15 * ew)
        ux1 = max(0, ux1)
        ux2 = min(w - 1, ux2)
        uy1 = max(0, uy1)
        uy2 = min(h - 1, uy2)
        under[uy1:uy2, ux1:ux2] = 255
        under = cv2.bitwise_and(under, skin_mask)

        cheek = np.zeros_like(eye_mask)
        cy1 = int(y1 + 1.85 * eh)
        cy2 = int(y1 + 3.10 * eh)
        if cy1 < h:
            cheek[cy1:cy2, ux1:ux2] = 255
        cheek = cv2.bitwise_and(cheek, skin_mask)

        under_pixels = lab[:, :, 0][under > 0]
        cheek_pixels = lab[:, :, 0][cheek > 0]
        if under_pixels.size < 50 or cheek_pixels.size < 50:
            continue

        under_l = float(np.mean(under_pixels))
        cheek_l = float(np.mean(cheek_pixels))
        delta = cheek_l - under_l

        dark_circle_sev += _severity_from_range(delta, 4.0, 16.0)
        under_eye_count += 1
        under_eye_debug[f"under_eye_delta_{side}"] = float(delta)

    if under_eye_count > 0:
        dark_circle_sev /= float(under_eye_count)

    puffy_sev = float(max(0.0, min(100.0, 0.65 * dark_circle_sev + 0.35 * wrinkles_sev)))

    base_conf = _clip01(float(quality.score))
    bright = _clip01(float(quality.brightness))
    sharp = _clip01(float(quality.blur))
    size_score = 0.0
    if quality.face_found:
        size_score = _clip01(float(quality.face_coverage) / 0.20)

    bright_centered = 1.0 - abs(bright - 0.55) / 0.55
    bright_centered = _clip01(float(bright_centered))
    highlight_strength = _clip01(float(highlight_ratio) / 0.03)
    under_eye_score = _clip01(float(under_eye_count) / 2.0)
    wrinkle_region_score = _clip01(float(wrinkles_den) / 2.0)

    def conf(*parts: float) -> float:
        c = float(base_conf)
        for p in parts:
            c *= float(p)
        return _clip01(c)

    redness_conf = conf(0.60 + 0.40 * bright_centered, 0.70 + 0.30 * size_score)
    uneven_conf = conf(0.60 + 0.40 * bright_centered, 0.70 + 0.30 * size_score)
    oiliness_conf = conf(0.55 + 0.45 * bright_centered, 0.60 + 0.40 * highlight_strength)
    texture_conf = conf(0.25 + 0.75 * sharp, 0.70 + 0.30 * size_score)
    wrinkles_conf = conf(0.25 + 0.75 * sharp, 0.70 + 0.30 * size_score, 0.60 + 0.40 * wrinkle_region_score)
    puffy_conf = conf(0.55 + 0.45 * bright_centered, 0.25 + 0.75 * sharp, 0.45 + 0.55 * under_eye_score)

    heatmaps: dict[str, str] = {}

    red_raw = np.maximum(0.0, lab[:, :, 1].astype(np.float32) - np.float32(a_mean))
    red_int = _norm01_pos_map(red_raw, skin_mask, 95.0)
    red_hm = _heatmap_data_uri(red_int, skin_mask, (94, 63, 244), max_alpha=0.85)
    if red_hm:
        heatmaps["redness"] = red_hm

    tone_raw = np.abs(lab[:, :, 0].astype(np.float32) - np.float32(l_mean))
    tone_int = _norm01_pos_map(tone_raw, skin_mask, 95.0)
    tone_hm = _heatmap_data_uri(tone_int, skin_mask, (11, 158, 245), max_alpha=0.75)
    if tone_hm:
        heatmaps["uneven_tone"] = tone_hm

    tex_raw = np.abs(lap).astype(np.float32)
    tex_int = _norm01_pos_map(tex_raw, skin_mask, 97.0)
    tex_hm = _heatmap_data_uri(tex_int, skin_mask, (250, 139, 167), max_alpha=0.78)
    if tex_hm:
        heatmaps["texture"] = tex_hm

    v_f = v.astype(np.float32)
    s_f = s.astype(np.float32)
    shine = np.clip((v_f - 200.0) / 55.0, 0.0, 1.0) * np.clip((90.0 - s_f) / 90.0, 0.0, 1.0)
    shine_int = _norm01_pos_map(shine, skin_mask, 99.0)
    shine_hm = _heatmap_data_uri(shine_int, skin_mask, (248, 189, 56), max_alpha=0.82)
    if shine_hm:
        heatmaps["oiliness"] = shine_hm

    wrinkles_mask = cv2.bitwise_or(forehead_mask, eye_ring)
    wr_raw = np.abs(lap).astype(np.float32) * (wrinkles_mask > 0).astype(np.float32)
    wr_int = _norm01_pos_map(wr_raw, wrinkles_mask, 97.0)
    wr_hm = _heatmap_data_uri(wr_int, wrinkles_mask, (22, 115, 249), max_alpha=0.75)
    if wr_hm:
        heatmaps["wrinkles"] = wr_hm

    heatmaps_out: dict[str, str] | None = heatmaps if heatmaps else None

    metrics = [
        _metric(
            "wrinkles",
            "Wrinkles & fine lines",
            wrinkles_sev,
            wrinkles_conf,
            "Derived from texture patterns around the eyes and forehead.",
            [
                "Use daily broad-spectrum SPF.",
                "Consider a retinoid at night (start slowly).",
                "Support barrier with moisturizer and ceramides.",
            ],
        ),
        _metric(
            "puffy_eyes",
            "Puffy eyes / under-eye",
            puffy_sev,
            puffy_conf,
            "Estimated from under-eye darkness + texture patterns.",
            [
                "Prioritize sleep consistency.",
                "Try a cold compress in the morning.",
                "Use a gentle eye moisturizer; avoid harsh actives near eyes.",
            ],
        ),
        _metric(
            "redness",
            "Redness / irritation",
            redness_sev,
            redness_conf,
            "Estimated from red channel components in Lab color space.",
            [
                "Use a gentle, fragrance-free cleanser.",
                "Avoid over-exfoliation if redness is persistent.",
                "If irritation persists, consider consulting a dermatologist.",
            ],
        ),
        _metric(
            "uneven_tone",
            "Uneven tone / spots",
            uneven_sev,
            uneven_conf,
            "Estimated from tone variance across skin pixels.",
            [
                "Use sunscreen consistently.",
                "Consider vitamin C in the morning.",
                "Introduce exfoliation gradually if tolerated.",
            ],
        ),
        _metric(
            "oiliness",
            "Oiliness",
            oiliness_sev,
            oiliness_conf,
            "Estimated from specular highlights on skin regions.",
            [
                "Use a lightweight non-comedogenic moisturizer.",
                "Consider niacinamide for oil control.",
                "Avoid stripping cleansers that can increase oil rebound.",
            ],
        ),
        _metric(
            "texture",
            "Texture / pores",
            texture_sev,
            texture_conf,
            "Estimated from high-frequency texture across the skin region.",
            [
                "Introduce BHA (salicylic acid) if you get clogged pores.",
                "Hydrate well; dehydrated skin can look more textured.",
                "Be consistent for 6-8 weeks before judging results.",
            ],
        ),
    ]

    fitz = _estimate_fitzpatrick(l_mean, b_mean)

    debug: dict[str, object] = {
        "lab_mean": {"l": l_mean, "a": a_mean, "b": b_mean},
        "lab_std": {"l": l_std},
        "highlight_ratio": highlight_ratio,
        "texture_value": texture_value,
        "wrinkles_value": wrinkles_value,
    }
    debug.update(under_eye_debug)

    return metrics, fitz, heatmaps_out, debug


def _classify_skin_type(metrics: list[MetricResult]) -> str:
    by_id = {m.id: m for m in metrics}
    oil = by_id.get("oiliness")
    tex = by_id.get("texture")
    red = by_id.get("redness")

    if not oil or not tex or not red:
        return "Unknown"

    if oil.severity > 65:
        return "Oily"
    if oil.severity < 35 and tex.severity > 55:
        return "Dry"
    if 35 <= oil.severity <= 65:
        return "Combination"
    if red.severity > 70 and oil.severity < 55:
        return "Sensitive"

    return "Normal"


def _estimate_skin_age(answers: AnalysisAnswers | None, metrics: list[MetricResult]) -> tuple[float | None, float | None]:
    if not answers or answers.age is None:
        return None, None

    by_id = {m.id: m for m in metrics}
    wrinkles = by_id.get("wrinkles")
    uneven = by_id.get("uneven_tone")
    redness = by_id.get("redness")

    if not wrinkles or not uneven or not redness:
        return None, None

    delta = 0.0
    delta += (wrinkles.severity - 50.0) / 10.0
    delta += (uneven.severity - 50.0) / 14.0
    delta += (redness.severity - 50.0) / 22.0

    if answers.lifestyle and answers.lifestyle.sunscreen_days_per_week is not None:
        spf = float(answers.lifestyle.sunscreen_days_per_week)
        delta -= (spf - 3.0) / 7.0

    delta = float(max(-10.0, min(delta, 15.0)))
    skin_age = float(answers.age) + delta

    return skin_age, delta


def _build_routine(skin_type: str, metrics: list[MetricResult]) -> list[RoutineStep]:
    by_id = {m.id: m for m in metrics}
    redness = by_id.get("redness")
    oil = by_id.get("oiliness")
    wrinkles = by_id.get("wrinkles")

    gentle = redness is not None and redness.severity > 60

    am_steps = [
        RoutineStep(time="AM", step="Gentle cleanser", why="Cleans without disrupting the skin barrier."),
        RoutineStep(time="AM", step="Moisturizer", why="Supports hydration and barrier function."),
        RoutineStep(time="AM", step="Broad-spectrum SPF 30+", why="Helps prevent uneven tone and premature aging."),
    ]

    pm_steps = [
        RoutineStep(time="PM", step="Cleanser", why="Removes sunscreen and buildup."),
        RoutineStep(time="PM", step="Moisturizer", why="Recovery and barrier support overnight."),
    ]

    if gentle:
        pm_steps.insert(1, RoutineStep(time="PM", step="Barrier serum (ceramides / panthenol)", why="Helps calm and support irritated skin."))

    if oil is not None and oil.severity > 55 and not gentle:
        pm_steps.insert(1, RoutineStep(time="PM", step="BHA (2-3x/week)", why="Helps with pores and oil control."))

    if wrinkles is not None and wrinkles.severity > 55 and not gentle:
        pm_steps.insert(1, RoutineStep(time="PM", step="Retinoid (start 1-2x/week)", why="Supports texture and fine lines over time."))

    if skin_type == "Dry":
        am_steps.insert(1, RoutineStep(time="AM", step="Hydrating serum (glycerin / HA)", why="Adds water-binding hydration."))
        pm_steps.append(RoutineStep(time="PM", step="Occlusive layer (optional)", why="Helps reduce overnight water loss."))

    if skin_type == "Oily":
        am_steps.insert(1, RoutineStep(time="AM", step="Niacinamide (optional)", why="Can help balance oil and support barrier."))

    return am_steps + pm_steps


def _overall_score(metrics: list[MetricResult]) -> float:
    if not metrics:
        return 0.0

    weights = {
        "wrinkles": 0.20,
        "puffy_eyes": 0.10,
        "redness": 0.20,
        "uneven_tone": 0.20,
        "oiliness": 0.15,
        "texture": 0.15,
    }

    tot_w = 0.0
    sev = 0.0
    for m in metrics:
        w = float(weights.get(m.id, 0.0))
        if w <= 0.0:
            continue
        sev += w * float(m.severity)
        tot_w += w

    if tot_w <= 0:
        return 0.0

    sev /= tot_w
    return float(max(0.0, min(100.0, 100.0 - sev)))


async def analyze_images(images: list[UploadFile], answers: AnalysisAnswers | None, debug: bool = False) -> AnalysisResponse:
    if not images:
        raise ValueError("No images provided")

    analyzed: list[tuple[_PerImage, float]] = []

    for upload in images:
        data = await upload.read()
        bgr = _decode_upload_to_bgr(data)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

        landmarks = _get_landmarks(rgb)
        quality = _compute_quality(gray, landmarks)

        if landmarks is None:
            analyzed.append(
                (
                    _PerImage(
                        metrics=[],
                        quality=quality,
                        skin_type="Unknown",
                        fitzpatrick=None,
                        skin_age=None,
                        skin_age_delta=None,
                        heatmaps=None,
                        debug=None,
                    ),
                    quality.score,
                )
            )
            continue

        masks = _skin_masks(bgr, landmarks)
        metrics, fitz, heatmaps, dbg = _compute_metrics(bgr, masks, quality)
        skin_type = _classify_skin_type(metrics)
        skin_age, skin_age_delta = _estimate_skin_age(answers, metrics)

        analyzed.append(
            (
                _PerImage(
                    metrics=metrics,
                    quality=quality,
                    skin_type=skin_type,
                    fitzpatrick=fitz,
                    skin_age=skin_age,
                    skin_age_delta=skin_age_delta,
                    heatmaps=heatmaps,
                    debug=dbg if debug else None,
                ),
                quality.score,
            )
        )

    selected_idx = int(max(range(len(analyzed)), key=lambda i: analyzed[i][1]))
    chosen = analyzed[selected_idx][0]

    routine = _build_routine(chosen.skin_type, chosen.metrics) if chosen.metrics else []
    overall = _overall_score(chosen.metrics)

    notes = [
        "This tool provides cosmetic-style insights only and is not a medical diagnosis.",
        "Results depend heavily on lighting, camera quality, and angle.",
    ]

    if chosen.quality.warnings:
        notes.append("Retake suggestions: " + " ".join(chosen.quality.warnings))

    return AnalysisResponse(
        analysis_id=str(uuid.uuid4()),
        selected_image=selected_idx,
        overall_score=overall,
        skin_type=chosen.skin_type,
        estimated_fitzpatrick=chosen.fitzpatrick,
        skin_age=chosen.skin_age,
        skin_age_delta=chosen.skin_age_delta,
        metrics=chosen.metrics,
        heatmaps=chosen.heatmaps,
        quality=chosen.quality,
        routine=routine,
        notes=notes,
        debug=chosen.debug,
    )
